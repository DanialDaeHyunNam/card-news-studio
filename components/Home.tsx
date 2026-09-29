"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Format, GenConfig, GenPhoto, Project } from "@/lib/types";
import { fileToGenPhoto, fileToRefImage } from "@/lib/image";
import { FORMATS, defaultTheme } from "@/lib/types";
import { newId } from "@/lib/ops";
import { getTemplates, instantiateTemplate } from "@/lib/templates";
import { exportProject, importProjectFile } from "@/lib/transfer";
import { GITHUB_URL, VERSION } from "@/lib/site";
import { MODELS, pickDefaultModel } from "@/lib/models";
import CardView from "./CardView";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";
import LogoMark from "./LogoMark";
import KeyPanel from "./KeyPanel";
import LangSwitch from "./LangSwitch";
import ModelPicker from "./ModelPicker";
import InstallGuide from "./InstallGuide";
import DiffModal from "./DiffModal";
import UpdateGuide from "./UpdateGuide";
import { useHosted, useUpdateCheck } from "@/lib/hooks";
import { clientKeyFlags } from "@/lib/client-keys";
import { trackEvent } from "@/lib/analytics";
import { useLang, type DictKey } from "@/lib/i18n";

interface HomeProps {
  projects: Project[];
  error?: string | null;
  busy?: boolean; // YouTube/Instagram pre-flight (captions, frames, slides)
  initial?: GenConfig | null; // restore the inputs of a failed generation
  onGenerate: (cfg: GenConfig) => void;
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
  onImport: (p: Project) => void;
}

const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;
const IG_RE = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]{5,}/;
const MAX_PHOTOS = 20;
const MAX_REF_IMAGES = 10;
const IMAGE_ACCEPT = "image/*,.heic,.heif";

type RefImage = { id: string; api: string; thumb: string };

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
}

export default function Home({ projects, error, busy, initial, onGenerate, onOpen, onCreate, onDelete, onImport }: HomeProps) {
  const { lang, t } = useLang();
  // On a public deploy the tool can't run (no local keys / localStorage), so
  // every "real action" opens the install guide instead of doing the action.
  const hosted = useHosted();
  const [showInstall, setShowInstall] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  // Local copies check the canonical deploy for a newer version.
  const { latest, hasUpdate } = useUpdateCheck(hosted);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updDismissed, setUpdDismissed] = useState(false);
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [format, setFormat] = useState<Format>(initial?.format ?? "4:5");
  const [cardCount, setCardCount] = useState(initial?.cardCount ?? 6);
  const [referenceId, setReferenceId] = useState("");
  const [model, setModel] = useState(() => pickDefaultModel(null));
  const [showKeys, setShowKeys] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean> | null>(null);
  const [writable, setWritable] = useState(true);
  // Brand point color: persists across projects; null = let the AI choose.
  const [accent, setAccentState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("cardnews.accent");
  });
  const isYoutube = YT_RE.test(topic);
  const isInstagram = IG_RE.test(topic);
  // Photo set: the user's own photos become full-bleed card backgrounds, cycled
  // card k → photo (k-1) mod N. Reference material (reels script, analytics,
  // screenshots) steers the copy.
  const [photos, setPhotos] = useState<GenPhoto[]>(initial?.photos ?? []);
  const [refText, setRefText] = useState(initial?.refText ?? "");
  const [refImages, setRefImages] = useState<RefImage[]>(
    () => initial?.refImages?.map((api) => ({ id: crypto.randomUUID(), api, thumb: api })) ?? [],
  );
  const [refOpen, setRefOpen] = useState(() => !!(initial?.refText || initial?.refImages?.length));
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const refImageInput = useRef<HTMLInputElement>(null);
  const hasMaterial = photos.length > 0 || refImages.length > 0 || refText.trim().length > 0;

  async function convertAll<T>(files: File[], convert: (f: File) => Promise<T>): Promise<T[]> {
    setAttachErr(null);
    setAttachBusy(true);
    const out: T[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try {
        out.push(await convert(f));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : f.name);
      }
    }
    setAttachBusy(false);
    if (errors.length) setAttachErr(errors.join(" · "));
    return out;
  }

  async function addPhotos(list: FileList | File[] | null | undefined) {
    const files = imageFiles(list).slice(0, MAX_PHOTOS - photos.length);
    if (!files.length) return;
    const added = await convertAll(files, fileToGenPhoto);
    if (!added.length) return;
    // First photos in → let the AI size the set to the content.
    if (photos.length === 0) setCardCount(0);
    setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS));
  }

  async function addRefImages(list: FileList | File[] | null | undefined) {
    const files = imageFiles(list).slice(0, MAX_REF_IMAGES - refImages.length);
    if (!files.length) return;
    const added = await convertAll(files, fileToRefImage);
    setRefImages((cur) => [...cur, ...added].slice(0, MAX_REF_IMAGES));
  }

  function movePhoto(from: number, dir: -1 | 1) {
    setPhotos((cur) => {
      const to = from + dir;
      if (to < 0 || to >= cur.length) return cur;
      const next = cur.slice();
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }
  // Project import: a .cardnews.json exported on another machine (images come
  // inlined; importProjectFile re-files them into public/uploads).
  const importInput = useRef<HTMLInputElement>(null);
  async function handleImportFile(file: File) {
    try {
      onImport(await importProjectFile(file, t("import_fallback_name")));
    } catch {
      alert(t("import_fail"));
    }
  }
  const importButton = (
    <button className="import-btn" onClick={() => importInput.current?.click()}>
      ⬆ {t("proj_import")}
    </button>
  );

  function setAccent(v: string | null) {
    setAccentState(v);
    if (v) window.localStorage.setItem("cardnews.accent", v);
    else window.localStorage.removeItem("cardnews.accent");
  }

  const templatePreviews = useMemo(
    () =>
      getTemplates(lang).map((tpl) => {
        const project = instantiateTemplate(tpl);
        return { tpl, firstCard: project.cards[0], theme: project.theme };
      }),
    [lang],
  );

  useEffect(() => {
    // Prefer a value model whose key is actually connected.
    const adoptKeys = (k: Record<string, boolean>) => {
      setKeys(k);
      setModel((cur) => {
        const info = MODELS.find((m) => m.id === cur);
        if (info && k[info.envVar]) return cur;
        return pickDefaultModel(k);
      });
    };
    if (hosted) {
      // BYOK: key presence lives in this browser (lib/client-keys), not on the server.
      adoptKeys(clientKeyFlags());
      return;
    }
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        adoptKeys(d.keys ?? {});
        setWritable(Boolean(d.writable));
      })
      .catch(() => setKeys({}));
  }, [hosted]);

  function emptyProject(): Project {
    const theme = defaultTheme();
    if (accent) theme.accent = accent;
    return {
      id: newId(),
      name: topic.trim().slice(0, 24) || t("new_project_name"),
      format,
      theme,
      cards: [
        {
          id: newId(),
          background: theme.background,
          elements: [
            {
              id: newId(),
              type: "text",
              x: 8,
              y: 40,
              w: 84,
              text: t("empty_title_text"),
              fontSize: 76,
              fontWeight: 800,
              color: theme.textColor,
              align: "center",
              lineHeight: 1.25,
            },
          ],
        },
      ],
      chat: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function startGenerate() {
    if (!topic.trim() && !hasMaterial) return;
    if (attachBusy) return;
    const selected = MODELS.find((m) => m.id === model);
    // Don't flash into the editor only to fail — nudge the key modal first.
    if (selected && keys && !keys[selected.envVar]) {
      setShowKeys(true);
      return;
    }
    trackEvent("generate_click", {
      model,
      format,
      youtube: isYoutube,
      instagram: isInstagram,
      photos: photos.length,
      refs: refImages.length + (refText.trim() ? 1 : 0),
    });
    onGenerate({
      topic,
      format,
      cardCount,
      model,
      referenceId: referenceId || undefined,
      accent: accent ?? undefined,
      photos: photos.length ? photos : undefined,
      refText: refText.trim() || undefined,
      refImages: refImages.length ? refImages.map((r) => r.api) : undefined,
    });
  }

  return (
    <div className="home">
      {/* Two-track bar: local install is the primary CTA (the better home);
          the browser IS the second track — you're already in it. The one-line
          question opens the honest comparison modal. */}
      {hosted && (
        <div className="track-bar">
          <button className="track-install" onClick={() => setShowInstall(true)}>
            <b>{t("track_install")}</b>
            <span>{t("track_install_sub")}</span>
          </button>
          <button className="track-q" onClick={() => setShowDiff(true)}>
            {t("track_q")} ↗
          </button>
        </div>
      )}
      {!hosted && hasUpdate && !updDismissed && (
        <div className="update-banner">
          <button className="update-banner-main" onClick={() => setShowUpdate(true)}>
            <span>
              {t("update_banner")} — <b>v{latest}</b>{" "}
              <span className="update-cur">({lang === "ko" ? "현재" : "now"} v{VERSION})</span>
            </span>
            <b className="update-cta">{t("update_banner_cta")} →</b>
          </button>
          <button
            className="update-banner-x"
            title="✕"
            onClick={() => setUpdDismissed(true)}
          >
            ✕
          </button>
        </div>
      )}
      <header className="home-nav">
        <div className="logo">
          <LogoMark size={22} /> Card News Studio
        </div>
        <div className="nav-actions">
          {!hosted && hasUpdate ? (
            <button
              className="btn ghost ver-chip update"
              onClick={() => setShowUpdate(true)}
              title={`v${VERSION} → v${latest}`}
            >
              ⬆ {t("ver_update_available")}
            </button>
          ) : GITHUB_URL ? (
            <a
              className="btn ghost ver-chip"
              href={`${GITHUB_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              title={t("ver_releases")}
            >
              v{VERSION}
            </a>
          ) : (
            <span className="btn ghost ver-chip">v{VERSION}</span>
          )}
          <LangSwitch />
          <button className="btn ghost" onClick={() => setShowKeys((v) => !v)}>
            🔑 {t("nav_keys")}
          </button>
          {GITHUB_URL && (
            <a className="btn ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub ⭐
            </a>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="overline">{t("hero_overline")}</div>
        <h1>
          {t("hero_h1_1")} <br />
          {t("hero_h1_2")}
        </h1>
        <p className="hero-sub">{t("hero_sub")}</p>

        <div
          className={`hero-bar ${dragOver ? "drag" : ""}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addPhotos(e.dataTransfer.files);
          }}
        >
          <input
            className="hero-input"
            placeholder={t("hero_ph")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onPaste={(e) => {
              const files = imageFiles(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                void addPhotos(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) startGenerate();
            }}
          />
          <button
            className="hero-attach"
            title={t("photo_add_title")}
            disabled={attachBusy || photos.length >= MAX_PHOTOS}
            onClick={() => photoInput.current?.click()}
          >
            {attachBusy ? "…" : "📷"}
            {photos.length > 0 && <span className="hero-attach-count">{photos.length}</span>}
          </button>
          <button
            className="btn pill-white"
            disabled={busy || attachBusy || (!hosted && !topic.trim() && !hasMaterial)}
            onClick={startGenerate}
          >
            {busy
              ? t("gen_busy")
              : isYoutube
                ? t("gen_btn_yt")
                : isInstagram
                  ? t("gen_btn_ig")
                  : photos.length
                    ? t("gen_btn_photos")
                    : t("gen_btn")}
          </button>
        </div>
        <input
          ref={photoInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void addPhotos(files);
          }}
        />
        <input
          ref={refImageInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void addRefImages(files);
          }}
        />

        {photos.length > 0 && (
          <div className="photo-tray">
            <div className="photo-tray-head">
              <span>
                {t("photo_tray_title")} · {photos.length}
              </span>
              <span className="photo-tray-hint">{t("photo_cycle_hint")}</span>
              <button className="link-mini" onClick={() => setPhotos([])}>
                {t("photo_clear")}
              </button>
            </div>
            <div className="photo-tray-row">
              {photos.map((p, i) => (
                <div key={p.id} className="photo-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" />
                  <span className="photo-num">{i + 1}</span>
                  <button
                    className="photo-x"
                    title="✕"
                    onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                  >
                    ✕
                  </button>
                  <div className="photo-move">
                    <button disabled={i === 0} onClick={() => movePhoto(i, -1)}>
                      ‹
                    </button>
                    <button disabled={i === photos.length - 1} onClick={() => movePhoto(i, 1)}>
                      ›
                    </button>
                  </div>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button className="photo-add" onClick={() => photoInput.current?.click()}>
                  +
                </button>
              )}
            </div>
          </div>
        )}
        {attachErr && <div className="hero-error attach-err">{attachErr}</div>}

        <div className="hero-controls">
          <div className="seg">
            {(Object.keys(FORMATS) as Format[]).map((f) => (
              <button
                key={f}
                className={format === f ? "on" : ""}
                title={t((f === "1:1" ? "fmt_11" : f === "4:5" ? "fmt_45" : "fmt_916") as DictKey)}
                onClick={() => setFormat(f)}
              >
                {FORMATS[f].label}
              </button>
            ))}
          </div>
          <select className="ctl" value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))}>
            <option value={0}>{t("cards_auto")}</option>
            {[4, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
                {t("cards_unit")}
              </option>
            ))}
          </select>
          <ModelPicker
            value={model}
            onChange={setModel}
            keys={keys}
            onConnectKey={() => setShowKeys(true)}
          />
          <div className="accent-ctl" title={t("accent_title")}>
            <span className="accent-label">{t("brand_label")}</span>
            <span className="accent-swatch" style={{ opacity: accent ? 1 : 0.4 }}>
              <input
                type="color"
                value={accent ?? "#3b82f6"}
                onChange={(e) => setAccent(e.target.value)}
              />
            </span>
            <button
              className={`accent-auto ${accent === null ? "on" : ""}`}
              onClick={() => setAccent(accent === null ? "#3b82f6" : null)}
            >
              {t("accent_auto")}
            </button>
          </div>
          {projects.length > 0 && (
            <select className="ctl" value={referenceId} onChange={(e) => setReferenceId(e.target.value)}>
              <option value="">{t("ref_none")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  ↻ {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            className={`ctl ref-toggle ${refOpen || refText.trim() || refImages.length ? "on" : ""}`}
            onClick={() => setRefOpen((v) => !v)}
          >
            📝 {t("ref_material")}
            {refImages.length + (refText.trim() ? 1 : 0) > 0 && ` · ${refImages.length + (refText.trim() ? 1 : 0)}`}
          </button>
        </div>

        {refOpen && (
          <div className="ref-panel">
            <textarea
              className="ref-text"
              placeholder={t("ref_text_ph")}
              value={refText}
              rows={5}
              onChange={(e) => setRefText(e.target.value)}
              onPaste={(e) => {
                const files = imageFiles(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  void addRefImages(files);
                }
              }}
            />
            <div className="ref-images">
              {refImages.map((r) => (
                <div key={r.id} className="photo-thumb small">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumb} alt="" />
                  <button
                    className="photo-x"
                    onClick={() => setRefImages((cur) => cur.filter((x) => x.id !== r.id))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {refImages.length < MAX_REF_IMAGES && (
                <button className="photo-add small" onClick={() => refImageInput.current?.click()}>
                  + {t("ref_add_images")}
                </button>
              )}
            </div>
            <p className="ref-hint">{t("ref_hint")}</p>
          </div>
        )}

        {GITHUB_URL && (
          <div className="star-cta-wrap">
            <a className="star-cta" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <span className="star">★</span> Star on GitHub
            </a>
          </div>
        )}

        {error && <div className="hero-error">{error}</div>}

        {/* only when there's actually something to lose/export — an empty
            workspace makes "back up with export" read as noise */}
        {hosted && projects.length > 0 && <p className="hosted-note-line">{t("home_hosted_note")}</p>}

        {/* No standalone "no key" banner: the model picker already shows a "No
            key" chip, and pressing Generate without a key opens the key modal
            itself — a third nudge was noise. */}
      </section>

      {showKeys && keys && (
        <div className="modal-overlay" onClick={() => setShowKeys(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{t("modal_title")}</span>
              <button className="modal-close" onClick={() => setShowKeys(false)}>
                ✕
              </button>
            </div>
            <KeyPanel
              keys={keys}
              writable={writable}
              hosted={hosted}
              selectedModelId={model}
              onSaved={(v) => setKeys({ ...keys, [v]: true })}
              onRemoved={(v) => setKeys({ ...keys, [v]: false })}
              onLocalGuide={() => {
                setShowKeys(false);
                setShowInstall(true);
              }}
            />
          </div>
        </div>
      )}

      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // allow re-picking the same file
          if (f) void handleImportFile(f);
        }}
      />

      {projects.length > 0 && (
        <section className="project-grid">
          <div className="section-head">
            <h2>{t("proj_title")}</h2>
            {importButton}
          </div>
          <div className="grid">
            {projects
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((p) => (
                <div key={p.id} className="project-card" onClick={() => onOpen(p.id)}>
                  <div className="project-preview">
                    <CardView card={p.cards[0]} theme={p.theme} format={p.format} width={200} />
                  </div>
                  <div className="project-meta">
                    <div className="project-name">{p.name}</div>
                    <div className="project-sub">
                      {FORMATS[p.format].label} · {p.cards.length}
                      {t("cards_unit")} ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US")}
                    </div>
                  </div>
                  <button
                    className="project-export"
                    title={t("proj_export_title")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void exportProject(p);
                    }}
                  >
                    ⬇
                  </button>
                  <button
                    className="project-delete"
                    title="삭제"
                    onClick={(e) => {
                      e.stopPropagation();
                      const msg =
                        lang === "ko" ? `"${p.name}" 프로젝트를 삭제할까요?` : `Delete "${p.name}"?`;
                      if (confirm(msg)) onDelete(p.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="templates">
        <div className="section-head">
          <h2>{t("tpl_title")}</h2>
          {projects.length === 0 && importButton /* fresh machine: import lives here */}
        </div>
        <p className="section-sub">{t("tpl_sub")}</p>
        <div className="tpl-grid">
          <button
            className="tpl-blank"
            onClick={() => {
              trackEvent("blank_create");
              onCreate(emptyProject());
            }}
          >
            <span className="tpl-blank-inner">
              <span className="tpl-blank-plus">+</span>
              <span className="tpl-blank-label">{t("blank_card")}</span>
            </span>
          </button>
          {templatePreviews.map(({ tpl, firstCard, theme }) => (
            <div
              key={tpl.id}
              className="tpl-card"
              onClick={() => {
                trackEvent("template_select", { template: tpl.id });
                onCreate(instantiateTemplate(tpl));
              }}
            >
              <div className="tpl-preview">
                <CardView card={firstCard} theme={theme} format={tpl.format} width={188} />
              </div>
              <div className="tpl-meta">
                <div className="tpl-name">
                  {tpl.name}{" "}
                  <span className="badge">
                    {tpl.format} · {tpl.cards.length}
                    {t("cards_unit")}
                  </span>
                </div>
                <div className="tpl-desc">{tpl.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <HowItWorks />
      <Footer />

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
      {showDiff && (
        <DiffModal
          onInstall={() => {
            setShowDiff(false);
            setShowInstall(true);
          }}
          onClose={() => setShowDiff(false)}
        />
      )}
      {showUpdate && <UpdateGuide latest={latest} onClose={() => setShowUpdate(false)} />}
    </div>
  );
}
