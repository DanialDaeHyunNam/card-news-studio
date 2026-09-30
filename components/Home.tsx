"use client";

import { useEffect, useRef, useState } from "react";
import type { GenConfig, Project } from "@/lib/types";
import { FORMATS, defaultTheme } from "@/lib/types";
import { newId } from "@/lib/ops";
import { getTemplates, instantiateTemplate } from "@/lib/templates";
import { exportProject, importProjectFile } from "@/lib/transfer";
import { GITHUB_URL, VERSION } from "@/lib/site";
import { MODELS, pickDefaultModel } from "@/lib/models";
import type { WizardState } from "@/lib/wizard";
import type { RefEntry } from "@/lib/references";
import type { ReferencePost } from "@/lib/reference";
import ReferenceLibrary from "./ReferenceLibrary";
import CardView from "./CardView";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";
import LogoMark from "./LogoMark";
import KeyPanel from "./KeyPanel";
import LangSwitch from "./LangSwitch";
import CreateWizard from "./CreateWizard";
import InstallGuide from "./InstallGuide";
import DiffModal from "./DiffModal";
import UpdateGuide from "./UpdateGuide";
import { useHosted, useUpdateCheck } from "@/lib/hooks";
import { clientKeyFlags } from "@/lib/client-keys";
import { trackEvent } from "@/lib/analytics";
import { useLang } from "@/lib/i18n";

interface HomeProps {
  projects: Project[];
  error?: string | null;
  busy?: boolean; // pre-flight before the editor opens (video frame pick)
  wizard: WizardState; // create-wizard answers — owned by Root so they survive failures
  setWizard: (fn: (w: WizardState) => WizardState) => void;
  library: RefEntry[]; // reference library (history + favorites)
  onReferenceLoaded: (post: ReferencePost) => void;
  onLibraryAdd: (post: ReferencePost) => Promise<void>;
  onLibraryFavorite: (id: string) => void;
  onLibraryDelete: (id: string) => void;
  onLibraryUse: (entry: RefEntry) => void | Promise<void>;
  onGenerate: (cfg: GenConfig) => void;
  onOpen: (id: string) => void;
  onCreate: (p: Project) => void;
  onDelete: (id: string) => void;
  onImport: (p: Project) => void;
}

export default function Home({
  projects,
  error,
  busy,
  wizard,
  setWizard,
  library,
  onReferenceLoaded,
  onLibraryAdd,
  onLibraryFavorite,
  onLibraryDelete,
  onLibraryUse,
  onGenerate,
  onOpen,
  onCreate,
  onDelete,
  onImport,
}: HomeProps) {
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
  const [showKeys, setShowKeys] = useState(false);
  const [keys, setKeys] = useState<Record<string, boolean> | null>(null);
  const [writable, setWritable] = useState(true);
  // Brand point color: persists across projects; null = let the AI choose.
  const [accent, setAccentState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("cardnews.accent");
  });
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


  useEffect(() => {
    // Prefer a value model whose key is actually connected.
    const adoptKeys = (k: Record<string, boolean>) => {
      setKeys(k);
      setWizard((w) => {
        const info = MODELS.find((m) => m.id === w.model);
        return info && k[info.envVar] ? w : { ...w, model: pickDefaultModel(k) };
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
    if (accent && accent !== "none") theme.accent = accent;
    return {
      id: newId(),
      name: t("new_project_name"),
      format: wizard.format,
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
            <a className="btn ghost nav-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
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

        <CreateWizard
          wizard={wizard}
          setWizard={setWizard}
          projects={projects}
          keys={keys}
          onConnectKey={() => setShowKeys(true)}
          accent={accent}
          setAccent={setAccent}
          busy={busy}
          error={error}
          onGenerate={onGenerate}
          library={library}
          onReferenceLoaded={onReferenceLoaded}
          onLibraryUse={onLibraryUse}
          onOpenTemplate={(id) => {
            const tpl = getTemplates(lang).find((x) => x.id === id);
            if (!tpl) return;
            trackEvent("template_select", { template: tpl.id });
            onCreate(instantiateTemplate(tpl));
          }}
        />
        {/* Manual starts live under the wizard now that templates are a wizard option. */}
        <div className="home-alt">
          <button
            className="link-mini"
            onClick={() => {
              trackEvent("blank_create");
              onCreate(emptyProject());
            }}
          >
            + {t("blank_card")}
          </button>
          {projects.length === 0 && importButton}
        </div>

        {GITHUB_URL && (
          <div className="star-cta-wrap">
            <a className="star-cta" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <span className="star">★</span> Star on GitHub
            </a>
          </div>
        )}


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
              selectedModelId={wizard.model}
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


      <ReferenceLibrary
        library={library}
        onAdd={onLibraryAdd}
        onToggleFavorite={onLibraryFavorite}
        onDelete={onLibraryDelete}
        onUse={onLibraryUse}
      />

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
