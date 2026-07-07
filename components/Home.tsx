"use client";

import { useEffect, useMemo, useState } from "react";
import type { Format, GenConfig, Project } from "@/lib/types";
import { FORMATS, defaultTheme } from "@/lib/types";
import { newId } from "@/lib/ops";
import { getTemplates, instantiateTemplate } from "@/lib/templates";
import { GITHUB_URL, VERSION } from "@/lib/site";
import { MODELS, PROVIDER_LABELS, pickDefaultModel } from "@/lib/models";
import CardView from "./CardView";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";
import LogoMark from "./LogoMark";
import KeyPanel from "./KeyPanel";
import LangSwitch from "./LangSwitch";
import ModelPicker from "./ModelPicker";
import InstallGuide from "./InstallGuide";
import UpdateGuide from "./UpdateGuide";
import { useHosted, useUpdateCheck } from "@/lib/hooks";
import { useLang, type DictKey } from "@/lib/i18n";

interface HomeProps {
  projects: Project[];
  error?: string | null;
  onGenerate: (cfg: GenConfig) => void;
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
}

const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;

export default function Home({ projects, error, onGenerate, onOpen, onCreate, onDelete }: HomeProps) {
  const { lang, t } = useLang();
  // On a public deploy the tool can't run (no local keys / localStorage), so
  // every "real action" opens the install guide instead of doing the action.
  const hosted = useHosted();
  const [showInstall, setShowInstall] = useState(false);
  // Local copies check the canonical deploy for a newer version.
  const { latest, hasUpdate } = useUpdateCheck(hosted);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updDismissed, setUpdDismissed] = useState(false);
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<Format>("4:5");
  const [cardCount, setCardCount] = useState(6);
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
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        const k: Record<string, boolean> = d.keys ?? {};
        setKeys(k);
        setWritable(Boolean(d.writable));
        // Prefer a value model whose key is actually connected.
        setModel((cur) => {
          const info = MODELS.find((m) => m.id === cur);
          if (info && k[info.envVar]) return cur;
          return pickDefaultModel(k);
        });
      })
      .catch(() => setKeys({}));
  }, []);

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
    if (hosted) return setShowInstall(true);
    if (!topic.trim()) return;
    const selected = MODELS.find((m) => m.id === model);
    // Don't flash into the editor only to fail — nudge the key modal first.
    if (selected && keys && !keys[selected.envVar]) {
      setShowKeys(true);
      return;
    }
    onGenerate({ topic, format, cardCount, model, referenceId: referenceId || undefined, accent: accent ?? undefined });
  }

  return (
    <div className="home">
      {hosted && (
        <button className="hosted-banner" onClick={() => setShowInstall(true)}>
          <span>🖥 {t("hosted_banner")}</span>
          <b>{t("hosted_banner_cta")} →</b>
        </button>
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
          <LangSwitch />
          <button
            className="btn ghost"
            onClick={() => (hosted ? setShowInstall(true) : setShowKeys((v) => !v))}
          >
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

        <div className="hero-bar">
          <input
            className="hero-input"
            placeholder={t("hero_ph")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) startGenerate();
            }}
          />
          <button className="btn pill-white" disabled={!hosted && !topic.trim()} onClick={startGenerate}>
            {isYoutube ? t("gen_btn_yt") : t("gen_btn")}
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
          <ModelPicker
            value={model}
            onChange={setModel}
            keys={keys}
            onConnectKey={() => (hosted ? setShowInstall(true) : setShowKeys(true))}
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
        </div>

        {GITHUB_URL && (
          <div className="star-cta-wrap">
            <a className="star-cta" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <span className="star">★</span> Star on GitHub
            </a>
          </div>
        )}

        {error && <div className="hero-error">{error}</div>}

        {(() => {
          if (hosted || !keys) return null;
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
          <button className="tpl-blank" onClick={() => onCreate(emptyProject())}>
            <span className="tpl-blank-inner">
              <span className="tpl-blank-plus">+</span>
              <span className="tpl-blank-label">{t("blank_card")}</span>
            </span>
          </button>
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

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
      {showUpdate && <UpdateGuide latest={latest} onClose={() => setShowUpdate(false)} />}
    </div>
  );
}
