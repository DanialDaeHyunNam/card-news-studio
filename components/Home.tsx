"use client";

import { useEffect, useMemo, useState } from "react";
import type { Format, Project } from "@/lib/types";
import { FORMATS, defaultTheme } from "@/lib/types";
import { newId, normalizeCard } from "@/lib/ops";
import { getTemplates, instantiateTemplate } from "@/lib/templates";
import { GITHUB_URL } from "@/lib/site";
import { DEFAULT_MODEL, MODELS, PROVIDER_LABELS } from "@/lib/models";
import { addUsage } from "@/lib/usage";
import CardView from "./CardView";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";
import LogoMark from "./LogoMark";
import KeyPanel from "./KeyPanel";
import LangSwitch from "./LangSwitch";
import { useLang, type DictKey } from "@/lib/i18n";

interface HomeProps {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
}

const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;

function mmss(t: number): string {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export default function Home({ projects, onOpen, onCreate, onDelete }: HomeProps) {
  const { lang, t } = useLang();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<Format>("4:5");
  const [cardCount, setCardCount] = useState(6);
  const [referenceId, setReferenceId] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean> | null>(null);
  const [writable, setWritable] = useState(true);
  const isYoutube = YT_RE.test(topic);

  const templatePreviews = useMemo(
    () =>
      getTemplates(lang).map((tpl) => {
        const project = instantiateTemplate(tpl);
        return { tpl, firstCard: project.cards[0], theme: project.theme };
      }),
    [lang],
  );

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        const k: Record<string, boolean> = d.keys ?? {};
        setKeys(k);
        setWritable(Boolean(d.writable));
        // Prefer a model whose key is actually connected.
        setModel((cur) => {
          const info = MODELS.find((m) => m.id === cur);
          if (info && k[info.envVar]) return cur;
          return MODELS.find((m) => m.implemented && k[m.envVar])?.id ?? cur;
        });
      })
      .catch(() => setKeys({}));
  }, []);

  function emptyProject(): Project {
    const theme = defaultTheme();
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

  async function generate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ref = projects.find((p) => p.id === referenceId);
      const reference = ref
        ? {
            theme: ref.theme,
            sampleTexts: ref.cards.flatMap((c) =>
              c.elements.filter((e) => e.type === "text").map((e) => (e.type === "text" ? e.text : "")),
            ),
          }
        : undefined;

      // YouTube URL → fetch the transcript first, then generate from it.
      let requestTopic = topic.trim();
      let projectName = requestTopic.slice(0, 24);
      let source: Record<string, unknown> | undefined;
      if (isYoutube) {
        setStatus(t("st_yt"));
        const ytRes = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: requestTopic }),
        });
        const yt = await ytRes.json();
        if (!ytRes.ok) throw new Error(yt.error || "자막을 가져오지 못했습니다.");
        const transcript = (yt.lines as { t: number; text: string }[])
          .map((l) => `[${mmss(l.t)}] ${l.text}`)
          .join("\n");
        source = { type: "youtube", url: requestTopic, title: yt.title, author: yt.author, transcript };
        projectName = (yt.title || t("yt_fallback_name")).slice(0, 24);
        requestTopic =
          lang === "ko"
            ? `아래 유튜브 영상의 자막으로 카드뉴스를 만들어줘: ${yt.title}`
            : `Create a card set from this YouTube video’s captions: ${yt.title}`;
      }

      setStatus(t("st_design"));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: requestTopic, format, cardCount, model, reference, source, lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `생성 실패 (${res.status})`);
      const theme = { ...defaultTheme(), ...data.theme };
      const project: Project = {
        id: newId(),
        name: projectName,
        format,
        theme,
        cards: (data.cards as { background?: string; elements?: Record<string, unknown>[] }[]).map((c) =>
          normalizeCard(c, theme),
        ),
        chat: [],
        model,
        usage: addUsage(undefined, data.usage),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (project.cards.length === 0) throw new Error("생성된 카드가 없습니다. 다시 시도해 주세요.");
      onCreate(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="home">
      <header className="home-nav">
        <div className="logo">
          <LogoMark size={22} /> Card News Studio
        </div>
        <div className="nav-actions">
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
          {t("hero_h1_1")} <br className="mobile-only" />
          {t("hero_h1_2")}
        </h1>
        <p className="hero-sub">{t("hero_sub")}</p>

        <div className="hero-bar">
          <input
            className="hero-input"
            placeholder={t("hero_ph")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) void generate();
            }}
          />
          <button className="btn pill-white" disabled={busy || !topic.trim()} onClick={() => void generate()}>
            {busy ? status || t("gen_busy") : isYoutube ? t("gen_btn_yt") : t("gen_btn")}
          </button>
        </div>

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
            {[4, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
                {t("cards_unit")}
              </option>
            ))}
          </select>
          <select className="ctl" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.implemented}>
                {m.short}
                {!m.implemented && ` · ${t("model_soon")}`}
              </option>
            ))}
          </select>
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
        </div>

        <button className="link-ghost" onClick={() => onCreate(emptyProject())}>
          {t("blank_start")}
        </button>

        {error && <div className="hero-error">{error}</div>}

        {(() => {
          if (!keys) return null;
          const selected = MODELS.find((m) => m.id === model)!;
          if (keys[selected.envVar]) return null;
          const hasAnyKey = Object.values(keys).some(Boolean);
          const provider = PROVIDER_LABELS[selected.envVar]?.label ?? selected.envVar;
          return (
            <button className="key-banner" onClick={() => setShowKeys(true)}>
              {hasAnyKey ? (
                <>
                  🔑 <b>{selected.short}</b> {t("banner_need_mid")} {provider} {t("banner_need_tail")}
                  <b>{t("banner_need_cta")}</b>
                </>
              ) : (
                <>
                  🔑 {t("banner_none")}
                  <b>{t("banner_none_cta")}</b>
                </>
              )}
            </button>
          );
        })()}
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
            <KeyPanel keys={keys} writable={writable} onSaved={(v) => setKeys({ ...keys, [v]: true })} />
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <section className="project-grid">
          <h2>{t("proj_title")}</h2>
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
        <h2>{t("tpl_title")}</h2>
        <p className="section-sub">{t("tpl_sub")}</p>
        <div className="tpl-grid">
          {templatePreviews.map(({ tpl, firstCard, theme }) => (
            <div key={tpl.id} className="tpl-card" onClick={() => onCreate(instantiateTemplate(tpl))}>
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
    </div>
  );
}

