"use client";

import { useState } from "react";
import { GITHUB_URL } from "@/lib/site";
import { useLang } from "@/lib/i18n";

// Shown ONLY on a hosted deploy (see useHosted) — the tool can't run on a public
// URL because API keys live in .env.local and projects in localStorage, both of
// which only exist on the user's own machine. This overlay walks a non-developer
// through installing + running locally, mirroring all-libertas.vercel.app:
// a macOS/Windows toggle, copyable terminal blocks, and three numbered steps.

type OS = "mac" | "win";

const REPO_URL = GITHUB_URL ?? "https://github.com/DanialDaeHyunNam/card-news-studio";
// "…/card-news-studio" → "card-news-studio" for the `cd` line.
const REPO_DIR = REPO_URL.replace(/\.git$/, "").split("/").pop() || "card-news-studio";
const RUN_COMMANDS = [
  `git clone ${REPO_URL}.git`,
  `cd ${REPO_DIR}`,
  "npm install",
  "npm run dev",
];

const NODE_URL = "https://nodejs.org/en/download";
const GIT_URL = "https://git-scm.com/downloads";

function detectOS(): OS {
  if (typeof navigator === "undefined") return "mac";
  return /win/i.test(navigator.userAgent) ? "win" : "mac";
}

function CopyButton({ text }: { text: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <button
      className={`inst-copy ${done ? "ok" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked (insecure context) — user can select manually */
        }
      }}
    >
      {done ? t("inst_copied") : t("inst_copy")}
    </button>
  );
}

export default function InstallGuide({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [os, setOs] = useState<OS>(detectOS);

  return (
    <div className="inst-overlay" onClick={onClose}>
      <div className="inst-panel" onClick={(e) => e.stopPropagation()}>
        <button className="inst-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="inst-head">
          <h2 className="inst-title">{t("inst_title")}</h2>
          <p className="inst-lede">{t("inst_lede")}</p>
          <div className="inst-badges">
            <span className="inst-badge free">✓ {t("inst_badge_free")}</span>
            <span className="inst-badge">🖥 {t("inst_badge_local")}</span>
            <span className="inst-badge">🔒 {t("inst_badge_key")}</span>
          </div>
          <div className="inst-os seg" role="tablist">
            <button className={os === "mac" ? "on" : ""} onClick={() => setOs("mac")}>
              {t("inst_os_mac")}
            </button>
            <button className={os === "win" ? "on" : ""} onClick={() => setOs("win")}>
              {t("inst_os_win")}
            </button>
          </div>
        </div>

        <ol className="inst-steps">
          {/* Step 1 — prerequisites. Installer downloads are the primary path
              (not everyone has Homebrew); brew is an optional shortcut. */}
          <li>
            <h3>{t("inst_s1_t")}</h3>
            <p>{os === "mac" ? t("inst_s1_mac") : t("inst_s1_win")}</p>
            <div className="inst-btn-row">
              <a className="btn ghost" href={NODE_URL} target="_blank" rel="noreferrer">
                {t("inst_get_node")}
              </a>
              <a className="btn ghost" href={GIT_URL} target="_blank" rel="noreferrer">
                {t("inst_get_git")}
              </a>
            </div>
            {os === "mac" && (
              <div className="inst-optional">
                <span className="inst-optional-label">{t("inst_s1_brew")}</span>
                <div className="inst-term compact">
                  <div className="inst-term-bar">
                    <i /> <i /> <i />
                    <span className="inst-term-title">Terminal — Homebrew</span>
                  </div>
                  <div className="inst-term-body">
                    <pre>
                      <code>
                        <span className="inst-prompt">$</span> brew install node git
                      </code>
                    </pre>
                    <CopyButton text="brew install node git" />
                  </div>
                </div>
              </div>
            )}
          </li>

          {/* Step 2 — clone, install, run. On Windows these run in Git Bash
              (bundled with Git), not PowerShell — so the prompt is always `$`. */}
          <li>
            <h3>{t("inst_s2_t")}</h3>
            <p>{t("inst_s2_desc")}</p>
            {os === "win" && <p className="inst-note">⚠ {t("inst_s2_win_note")}</p>}
            <div className="inst-term">
              <div className="inst-term-bar">
                <i /> <i /> <i />
                <span className="inst-term-title">{os === "win" ? "Git Bash" : "Terminal"}</span>
              </div>
              <div className="inst-term-body">
                <pre>
                  <code>
                    {RUN_COMMANDS.map((c) => (
                      <span key={c} className="inst-line">
                        <span className="inst-prompt">$</span> {c}
                      </span>
                    ))}
                  </code>
                </pre>
                <CopyButton text={RUN_COMMANDS.join("\n")} />
              </div>
            </div>
            <p className="inst-note">↳ {t("inst_s2_note")}</p>
          </li>

          {/* Step 3 — open + key */}
          <li>
            <h3>{t("inst_s3_t")}</h3>
            <p>{t("inst_s3_desc")}</p>
            <div className="inst-browser">
              <div className="inst-browser-bar">
                <i /> <i /> <i />
                <span className="inst-url">
                  <span className="lock">🔒</span> localhost<span className="port">:3000</span>
                </span>
              </div>
              <div className="inst-browser-view">
                <span className="inst-browser-pill" />
                <span className="inst-browser-cards">
                  <i /> <i /> <i /> <i />
                </span>
                <span className="inst-browser-hint">{t("inst_browser_hint")}</span>
              </div>
            </div>
          </li>
        </ol>

        <div className="inst-foot">
          <a className="inst-source" href={REPO_URL} target="_blank" rel="noreferrer">
            {t("inst_source")}
          </a>
        </div>
      </div>
    </div>
  );
}
