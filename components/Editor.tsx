"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { Card, CardElement, GenProgress, Operation, Project, TextElement } from "@/lib/types";
import { EXPORT_WIDTH, FORMATS } from "@/lib/types";
import { applyOperations, applyRoleStyle, enforceRoles, newId } from "@/lib/ops";
import { collectTargets, snapPosition } from "@/lib/snap";
import { DEFAULT_MODEL, MODELS, pickDefaultModel } from "@/lib/models";
import { addUsage, emptyUsage, fmtCost, fmtTokens, type UsageEvent, type UsageTotals } from "@/lib/usage";
import { useLang } from "@/lib/i18n";
import { useClickOutside, useHosted } from "@/lib/hooks";
import LangSwitch from "./LangSwitch";
import CardView, { cardHeight } from "./CardView";
import Inspector from "./Inspector";
import ChatPanel from "./ChatPanel";
import ModelPicker from "./ModelPicker";
import KeyPanel from "./KeyPanel";
import Slideshow from "./Slideshow";
import InstallGuide from "./InstallGuide";

const SNAP_PX = 6;

interface DragState {
  mode: "move" | "resize";
  cardId: string;
  elId: string;
  startClientX: number;
  startClientY: number;
  baseX: number;
  baseY: number;
  baseW: number;
  baseH: number; // percent h for shape/image (resize)
  measuredH: number; // rendered height percent (snapping)
  hasH: boolean;
  targetsV: number[];
  targetsH: number[];
  displayW: number;
  displayH: number;
  pushed: boolean;
}

interface EditorProps {
  project: Project;
  onChange: (p: Project) => void;
  onClose: () => void;
  generating?: GenProgress | null;
}

export default function Editor({ project, onChange, onClose, generating }: EditorProps) {
  const { lang, t } = useLang();
  const gen = !!generating;
  const [cardIdx, setCardIdx] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [editingElId, setEditingElId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] } | null>(null);
  const [exportJob, setExportJob] = useState<{ card: Card; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean> | null>(null);
  const [keyWritable, setKeyWritable] = useState(true);
  const [showKeys, setShowKeys] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  // Hosted deploy: the canvas is fully explorable, but anything needing a local
  // key (AI chat, connecting a key) routes to the install guide instead.
  const hosted = useHosted();
  const [showInstall, setShowInstall] = useState(false);
  const needInstall = () => setShowInstall(true);
  // Brand point color (global, persisted). Changing it recolors every element
  // that used the old accent — the accent behaves like a variable/token.
  const [brandColor, setBrandColor] = useState<string>(() => {
    if (typeof window === "undefined") return project.theme.accent || "#3b82f6";
    return window.localStorage.getItem("cardnews.accent") || project.theme.accent || "#3b82f6";
  });

  function setBrand(v: string) {
    setBrandColor(v);
    try {
      window.localStorage.setItem("cardnews.accent", v);
    } catch {
      /* ignore */
    }
  }

  // Apply an accent to this set: retarget theme.accent AND recolor every element
  // currently using the old accent color, so the point color cascades everywhere.
  function applyAccent(next: string) {
    mutate((p) => reAccent(p, next), true);
  }

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        const k: Record<string, boolean> = d.keys ?? {};
        setKeyStatus(k);
        setKeyWritable(Boolean(d.writable));
        // If this project's model has no connected key, switch to a value model
        // whose key is connected.
        const cur = MODELS.find((m) => m.id === (projectRef.current.model ?? DEFAULT_MODEL));
        const target = pickDefaultModel(k);
        const targetInfo = MODELS.find((m) => m.id === target);
        if ((!cur || !k[cur.envVar]) && targetInfo && k[targetInfo.envVar] && target !== projectRef.current.model) {
          mutate((p) => void (p.model = target));
        }
      })
      .catch(() => setKeyStatus({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While generating, follow the newest card so the canvas "draws" too; reset
  // to the first card once the run finishes.
  useEffect(() => {
    if (gen) {
      if (project.cards.length > 0) setCardIdx(project.cards.length - 1);
    } else {
      setCardIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen, project.cards.length]);

  const projectRef = useRef(project);
  projectRef.current = project;
  const dragRef = useRef<DragState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportResolveRef = useRef<(() => void) | null>(null);
  const historyRef = useRef<Project[]>([]);

  // Cards can momentarily be empty while a fresh generation is still streaming.
  const safeCardIdx = project.cards.length ? Math.min(cardIdx, project.cards.length - 1) : 0;
  const card = project.cards[safeCardIdx] as Card | undefined;
  const selectedEl = card?.elements.find((e) => e.id === selectedElId) ?? null;
  const editingEl = (card?.elements.find((e) => e.id === editingElId) ?? null) as TextElement | null;

  const displayW = project.format === "9:16" ? 330 : 470;
  const displayH = cardHeight(project.format, displayW);
  const scale = displayW / EXPORT_WIDTH;

  function pushHistory() {
    historyRef.current.push(structuredClone(projectRef.current));
    if (historyRef.current.length > 60) historyRef.current.shift();
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (prev) {
      onChange(prev);
      setSelectedElId(null);
      setEditingElId(null);
    }
  }

  // All state changes flow through here (except undo, which restores a snapshot).
  function mutate(fn: (p: Project) => void, withHistory = false) {
    if (withHistory) pushHistory();
    const p = structuredClone(projectRef.current);
    fn(p);
    p.updatedAt = Date.now();
    onChange(p);
  }

  function patchElement(cardId: string, elId: string, patch: Record<string, unknown>, withHistory = false) {
    mutate((p) => {
      const el = p.cards.find((c) => c.id === cardId)?.elements.find((e) => e.id === elId);
      if (el) Object.assign(el, patch);
    }, withHistory);
  }

  // --- drag / resize ------------------------------------------------------
  function startDrag(e: React.PointerEvent, el: CardElement, mode: "move" | "resize") {
    if (editingElId || !card) return;
    e.preventDefault();
    setSelectedElId(el.id);
    const cardNode = stageRef.current?.querySelector<HTMLElement>(".cardview");
    if (!cardNode) return;
    const { targetsV, targetsH, rects } = collectTargets(cardNode, el.id);
    const measured = rects.get(el.id);
    dragRef.current = {
      mode,
      cardId: card.id,
      elId: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      baseX: el.x,
      baseY: el.y,
      baseW: el.w,
      baseH: el.type === "text" ? 0 : el.h,
      measuredH: measured?.h ?? 5,
      hasH: el.type !== "text",
      targetsV,
      targetsH,
      displayW,
      displayH,
      pushed: false,
    };
  }

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      ev.preventDefault();
      if (!d.pushed) {
        pushHistory();
        d.pushed = true;
      }
      const dx = ((ev.clientX - d.startClientX) / d.displayW) * 100;
      const dy = ((ev.clientY - d.startClientY) / d.displayH) * 100;
      if (d.mode === "move") {
        const snapped = snapPosition({
          x: d.baseX + dx,
          y: d.baseY + dy,
          w: d.baseW,
          h: d.measuredH,
          targetsV: d.targetsV,
          targetsH: d.targetsH,
          thresholdV: (SNAP_PX / d.displayW) * 100,
          thresholdH: (SNAP_PX / d.displayH) * 100,
        });
        setGuides(snapped.guides.v.length || snapped.guides.h.length ? snapped.guides : null);
        patchElement(d.cardId, d.elId, {
          x: Math.round(snapped.x * 100) / 100,
          y: Math.round(snapped.y * 100) / 100,
        });
      } else {
        const patch: Record<string, number> = {
          w: Math.round(Math.max(3, d.baseW + dx) * 100) / 100,
        };
        if (d.hasH) patch.h = Math.round(Math.max(2, d.baseH + dy) * 100) / 100;
        patchElement(d.cardId, d.elId, patch);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setGuides(null);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- keyboard -----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selectedElId) {
        e.preventDefault();
        removeElement(selectedElId);
      } else if (e.key === "Escape") {
        setEditingElId(null);
        setSelectedElId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElId, safeCardIdx]);

  // --- element / card CRUD -------------------------------------------------
  function removeElement(elId: string) {
    if (!card) return;
    mutate((p) => {
      const c = p.cards.find((x) => x.id === card.id);
      if (c) c.elements = c.elements.filter((e) => e.id !== elId);
    }, true);
    setSelectedElId(null);
  }

  function addElement(el: CardElement) {
    if (!card) return;
    mutate((p) => {
      p.cards.find((x) => x.id === card.id)?.elements.push(el);
    }, true);
    setSelectedElId(el.id);
  }

  // Change stacking order (elements render in array order; 0 = back).
  function reorderElement(elId: string, dir: "back" | "backward" | "forward" | "front") {
    if (!card) return;
    mutate((p) => {
      const c = p.cards.find((x) => x.id === card.id);
      if (!c) return;
      const i = c.elements.findIndex((e) => e.id === elId);
      if (i < 0) return;
      const [el] = c.elements.splice(i, 1);
      const j =
        dir === "back"
          ? 0
          : dir === "front"
            ? c.elements.length
            : dir === "backward"
              ? Math.max(0, i - 1)
              : Math.min(c.elements.length, i + 1);
      c.elements.splice(j, 0, el);
    }, true);
  }

  function addCard() {
    const c: Card = {
      id: newId(),
      background: project.theme.background,
      elements: [
        {
          id: newId(),
          type: "text",
          x: 8,
          y: 42,
          w: 84,
          text: "새 카드",
          fontSize: 64,
          fontWeight: 800,
          color: project.theme.textColor,
          align: "center",
          lineHeight: 1.3,
        },
      ],
    };
    mutate((p) => p.cards.splice(safeCardIdx + 1, 0, c), true);
    setCardIdx(safeCardIdx + 1);
    setSelectedElId(null);
  }

  function duplicateCard(idx: number) {
    mutate((p) => {
      const copy = structuredClone(p.cards[idx]);
      copy.id = newId();
      copy.elements.forEach((e) => (e.id = newId()));
      p.cards.splice(idx + 1, 0, copy);
    }, true);
    setCardIdx(idx + 1);
  }

  function removeCard(idx: number) {
    if (project.cards.length <= 1) return;
    mutate((p) => p.cards.splice(idx, 1), true);
    setCardIdx(Math.max(0, Math.min(idx, project.cards.length - 2)));
    setSelectedElId(null);
  }

  function moveCard(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= project.cards.length) return;
    mutate((p) => {
      const [c] = p.cards.splice(idx, 1);
      p.cards.splice(to, 0, c);
    }, true);
    setCardIdx(to);
  }

  // --- AI chat apply --------------------------------------------------------
  function applyChat(args: {
    userText: string;
    userThumbs: string[];
    reply: string;
    operations: Operation[];
    attachmentOriginals: string[];
    usage?: UsageEvent;
  }) {
    pushHistory();
    let next = applyOperations(projectRef.current, args.operations, args.attachmentOriginals);
    next = {
      ...next,
      usage: addUsage(next.usage, args.usage),
      chat: [
        ...next.chat,
        { role: "user" as const, text: args.userText, images: args.userThumbs.length ? args.userThumbs : undefined },
        { role: "assistant" as const, text: args.reply, ops: args.operations.length },
      ],
    };
    onChange(next);
  }

  // --- PNG export -----------------------------------------------------------
  useEffect(() => {
    if (!exportJob || !exportRef.current) return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 100)); // let images paint
      try {
        const url = await toPng(exportRef.current!, { skipFonts: true, pixelRatio: 1 });
        if (!cancelled) {
          const a = document.createElement("a");
          a.href = url;
          a.download = exportJob.name;
          a.click();
        }
      } catch (err) {
        console.error(err);
        alert(t("ed_export_fail"));
      }
      exportResolveRef.current?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [exportJob]);

  async function exportPng(cards: { card: Card; index: number }[]) {
    if (exporting) return;
    setExporting(true);
    const base = (project.name || "card").replace(/[^\w가-힣-]+/g, "_");
    for (const { card: c, index } of cards) {
      await new Promise<void>((resolve) => {
        exportResolveRef.current = resolve;
        setExportJob({ card: c, name: `${base}-${String(index + 1).padStart(2, "0")}.png` });
      });
    }
    setExportJob(null);
    setExporting(false);
  }

  // ---------------------------------------------------------------------------
  return (
    <div className={`editor ${gen ? "gen" : ""}`}>
      <header className="topbar">
        <button className="btn ghost" onClick={onClose} disabled={gen}>
          {t("ed_back")}
        </button>
        <input
          className="name-input"
          value={project.name}
          readOnly={gen}
          onFocus={pushHistory}
          onChange={(e) => mutate((p) => void (p.name = e.target.value))}
        />
        <span className="badge">
          {FORMATS[project.format].label} · {FORMATS[project.format].w}×{FORMATS[project.format].h}
        </span>
        <ModelPicker
          value={project.model ?? DEFAULT_MODEL}
          onChange={(id) => mutate((p) => void (p.model = id), true)}
          keys={keyStatus}
          onConnectKey={() => (hosted ? needInstall() : setShowKeys(true))}
          disabled={gen}
        />
        <div className="accent-ctl" title={t("brand_title")}>
          <span className="accent-label">{t("brand_label")}</span>
          <span className="accent-swatch">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(project.theme.accent) ? project.theme.accent : "#3b82f6"}
              disabled={gen}
              onChange={(e) => {
                const v = e.target.value;
                applyAccent(v); // cascade: recolor every element using the point color
                if (!project.ignoreBrand) setBrand(v); // following → this becomes the brand
              }}
            />
          </span>
          <button
            className={`accent-auto ${project.ignoreBrand ? "on" : ""}`}
            disabled={gen}
            title={t("brand_title")}
            onClick={() => {
              if (project.ignoreBrand) {
                // re-follow the brand: adopt the global brand color into this set
                mutate((p) => {
                  p.ignoreBrand = false;
                  reAccent(p, brandColor);
                }, true);
              } else {
                mutate((p) => void (p.ignoreBrand = true), true);
              }
            }}
          >
            {t("brand_ignore")}
          </button>
        </div>
        <UsageChip usage={project.usage} />
        <div className="spacer" />
        <LangSwitch />
        <button className="btn ghost" onClick={undo} disabled={gen || historyRef.current.length === 0}>
          {t("ed_undo")}
        </button>
        <button
          className="btn ghost"
          onClick={() => setShowSlideshow(true)}
          disabled={gen || project.cards.length === 0}
        >
          {t("ed_slideshow")}
        </button>
        <button
          className="btn"
          disabled={exporting || gen || !card}
          onClick={() => card && exportPng([{ card, index: safeCardIdx }])}
        >
          {t("ed_export_one")}
        </button>
        <button
          className="btn primary"
          disabled={exporting || gen || project.cards.length === 0}
          onClick={() => exportPng(project.cards.map((c, i) => ({ card: c, index: i })))}
        >
          {exporting ? t("ed_exporting") : t("ed_export_all")}
        </button>
      </header>

      <div className={`editor-body ${gen ? "gen" : ""}`}>
        {gen ? (
          <>
            <aside className="cards-strip gen">
              {project.cards.map((c, i) => (
                <div key={c.id} className={`thumb ${i === safeCardIdx ? "active" : ""}`}>
                  <div className="thumb-preview">
                    <CardView card={c} theme={project.theme} format={project.format} width={112} />
                  </div>
                  <div className="thumb-bar">
                    <span className="thumb-num">{i + 1}</span>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, (generating?.total ?? 0) - project.cards.length) }).map((_, i) => (
                <div key={`ghost-${i}`} className="thumb ghost">
                  <div className="thumb-preview shimmer" />
                </div>
              ))}
            </aside>

            <section className="canvas-area gen-canvas">
              {card ? (
                <div className="canvas-stage" style={{ width: displayW, height: displayH }}>
                  <CardView key={card.id} card={card} theme={project.theme} format={project.format} width={displayW} />
                </div>
              ) : (
                <div className="gen-prep" style={{ width: displayW, height: displayH }}>
                  <div className="gen-spinner" />
                  <p>{t("gen_designing")}</p>
                </div>
              )}
              <div className="gen-progress-pill">
                <span className="gen-spinner sm" />
                {project.cards.length > 0
                  ? lang === "ko"
                    ? `카드 ${project.cards.length} / ${generating?.total} 만드는 중…`
                    : `Building card ${project.cards.length} / ${generating?.total}…`
                  : t("gen_designing")}
              </div>
            </section>
          </>
        ) : card ? (
          <>
            <aside className="cards-strip">
              {project.cards.map((c, i) => (
                <div
                  key={c.id}
                  className={`thumb ${i === safeCardIdx ? "active" : ""}`}
                  onClick={() => {
                    setCardIdx(i);
                    setSelectedElId(null);
                    setEditingElId(null);
                  }}
                >
                  <div className="thumb-preview">
                    <CardView card={c} theme={project.theme} format={project.format} width={112} />
                  </div>
                  <div className="thumb-bar">
                    <span className="thumb-num">{i + 1}</span>
                    <button title={t("th_up")} onClick={(e) => (e.stopPropagation(), moveCard(i, -1))}>↑</button>
                    <button title={t("th_down")} onClick={(e) => (e.stopPropagation(), moveCard(i, 1))}>↓</button>
                    <button title={t("th_dup")} onClick={(e) => (e.stopPropagation(), duplicateCard(i))}>⧉</button>
                    <button title={t("th_del")} onClick={(e) => (e.stopPropagation(), removeCard(i))}>✕</button>
                  </div>
                </div>
              ))}
              <button className="btn add-card" onClick={addCard}>
                {t("ed_add_card")}
              </button>
            </aside>

            <section className="canvas-area">
              <div className="canvas-stage" ref={stageRef} style={{ width: displayW, height: displayH }}>
                <CardView
                  card={card}
                  theme={project.theme}
                  format={project.format}
                  width={displayW}
                  selectedElementId={selectedElId}
                  editingElementId={editingElId}
                  guides={guides ?? undefined}
                  onElementPointerDown={(e, el) => startDrag(e, el, "move")}
                  onElementDoubleClick={(el) => {
                    if (el.type === "text") {
                      pushHistory();
                      setEditingElId(el.id);
                    }
                  }}
                  onResizeStart={(e, el) => startDrag(e, el, "resize")}
                  onBackgroundPointerDown={() => {
                    setSelectedElId(null);
                    setEditingElId(null);
                  }}
                />
                {editingEl && (
                  <InlineTextEditor
                    el={editingEl}
                    scale={scale}
                    fontFamily={editingEl.fontFamily || project.theme.fontFamily}
                    onChange={(text) => patchElement(card.id, editingEl.id, { text })}
                    onDone={() => setEditingElId(null)}
                  />
                )}
              </div>
            </section>

            <Inspector
              project={project}
              card={card}
              element={selectedEl}
              beginEdit={pushHistory}
              onPatchElement={(patch, withHistory) =>
                selectedEl && patchElement(card.id, selectedEl.id, patch, withHistory)
              }
              onPatchCard={(patch) => mutate((p) => Object.assign(p.cards.find((c) => c.id === card.id)!, patch), true)}
              onPatchTheme={(patch) => mutate((p) => Object.assign(p.theme, patch), true)}
              onRemoveElement={() => selectedEl && removeElement(selectedEl.id)}
              onReorderElement={reorderElement}
              onSelectElement={setSelectedElId}
              onAddElement={addElement}
              onApplyRoleStyle={(role, patch) => {
                pushHistory();
                onChange(applyRoleStyle(projectRef.current, role, patch));
              }}
              onEnforceRoles={() => {
                pushHistory();
                onChange(enforceRoles(projectRef.current));
              }}
            />

            <ChatPanel
              project={project}
              selection={{ cardId: card.id, elementId: selectedElId ?? undefined }}
              selectionLabel={
                selectedEl
                  ? `${t("sel_card")} ${safeCardIdx + 1} · ${selectedEl.type === "text" ? t("sel_text") : selectedEl.type === "shape" ? t("sel_shape") : t("sel_image")}`
                  : `${t("sel_card")} ${safeCardIdx + 1}`
              }
              onBlocked={hosted ? needInstall : undefined}
              onApply={applyChat}
            />
          </>
        ) : null}
      </div>

      {exportJob && (
        <div style={{ position: "fixed", left: -20000, top: 0 }}>
          <div ref={exportRef} style={{ width: EXPORT_WIDTH }}>
            <CardView card={exportJob.card} theme={project.theme} format={project.format} width={EXPORT_WIDTH} />
          </div>
        </div>
      )}

      {showSlideshow && project.cards.length > 0 && (
        <Slideshow project={project} start={safeCardIdx} onClose={() => setShowSlideshow(false)} />
      )}

      {showKeys && keyStatus && (
        <div className="modal-overlay" onClick={() => setShowKeys(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{t("modal_title")}</span>
              <button className="modal-close" onClick={() => setShowKeys(false)}>
                ✕
              </button>
            </div>
            <KeyPanel
              keys={keyStatus}
              writable={keyWritable}
              onSaved={(v) => setKeyStatus((k) => ({ ...(k ?? {}), [v]: true }))}
            />
          </div>
        </div>
      )}

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
    </div>
  );
}

// Normalize a hex color for comparison (#abc → #aabbcc, lowercased).
function normHex(c: string): string {
  const h = c.trim().toLowerCase();
  const m = /^#([0-9a-f]{3})$/.exec(h);
  return m ? `#${m[1].split("").map((x) => x + x).join("")}` : h;
}

// Point color as a token: set theme.accent and recolor every text/shape element
// that used the previous accent, so one change updates it everywhere.
function reAccent(p: Project, next: string) {
  const prev = normHex(p.theme.accent);
  p.theme.accent = next;
  for (const c of p.cards) {
    for (const el of c.elements) {
      if ((el.type === "text" || el.type === "shape") && normHex(el.color) === prev) {
        el.color = next;
      }
    }
  }
}

function UsageChip({ usage }: { usage?: UsageTotals }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false), open);
  const u = usage ?? emptyUsage();
  const totalTokens = u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheCreationTokens;
  return (
    <div className="usage-wrap" ref={wrapRef}>
      <button className="btn ghost" onClick={() => setOpen((v) => !v)} title={t("usage_title")}>
        ⚡ {fmtCost(u.costUsd)} · {fmtTokens(totalTokens)} tok
      </button>
      {open && (
        <div className="usage-pop">
          <div className="usage-row big">
            <span>{t("usage_total")}</span>
            <b>{fmtCost(u.costUsd)}</b>
          </div>
          <div className="usage-row">
            <span>{t("usage_calls")}</span>
            <b>{lang === "ko" ? `${u.calls}회` : `×${u.calls}`}</b>
          </div>
          <div className="usage-row">
            <span>{t("usage_in")}</span>
            <b>{fmtTokens(u.inputTokens)}</b>
          </div>
          <div className="usage-row">
            <span>{t("usage_out")}</span>
            <b>{fmtTokens(u.outputTokens)}</b>
          </div>
          <div className="usage-row">
            <span>{t("usage_cache")}</span>
            <b>
              {fmtTokens(u.cacheReadTokens)} / {fmtTokens(u.cacheCreationTokens)}
            </b>
          </div>
          {Object.keys(u.byModel).length > 0 && <div className="usage-sep" />}
          {Object.entries(u.byModel).map(([id, m]) => (
            <div className="usage-row" key={id}>
              <span>{MODELS.find((x) => x.id === id)?.label ?? id}</span>
              <b>
                {lang === "ko" ? `${m.calls}회` : `×${m.calls}`} · {fmtCost(m.costUsd)}
              </b>
            </div>
          ))}
          <div className="usage-note">{t("usage_note")}</div>
        </div>
      )}
    </div>
  );
}

function InlineTextEditor({
  el,
  scale,
  fontFamily,
  onChange,
  onDone,
}: {
  el: TextElement;
  scale: number;
  fontFamily: string;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
    }
  }, [el.text]);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="inline-edit"
      value={el.text}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) onDone();
      }}
      style={{
        position: "absolute",
        left: `${el.x}%`,
        top: `${el.y}%`,
        width: `${el.w}%`,
        fontSize: el.fontSize * scale,
        fontWeight: el.fontWeight,
        color: el.color,
        textAlign: el.align,
        lineHeight: el.lineHeight,
        letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}em` : undefined,
        fontFamily,
      }}
    />
  );
}
