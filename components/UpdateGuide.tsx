"use client";

import { CANONICAL_URL, GITHUB_URL, VERSION } from "@/lib/site";
import { useLang } from "@/lib/i18n";
import LangSwitch from "./LangSwitch";
import CopyButton from "./CopyButton";

// Shown on a local copy when a newer version is deployed (see useUpdateCheck).
// Same visual language as InstallGuide, but for updating: an AI-CLI one-liner
// (recommended) + a manual `git pull` path. Your projects/keys are untouched.
const UPDATE_COMMANDS = ["git pull", "npm install", "npm run dev"];

export default function UpdateGuide({ latest, onClose }: { latest: string | null; onClose: () => void }) {
  const { t } = useLang();
  const aiPrompt = t("upd_ai_prompt");

  return (
    <div className="inst-overlay" onClick={onClose}>
      <div className="inst-panel" onClick={(e) => e.stopPropagation()}>
        <div className="inst-topbar">
          <LangSwitch />
          <button className="inst-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="inst-head">
          <h2 className="inst-title">{t("upd_title")}</h2>
          <div className="upd-versions">
            <span className="upd-ver old">v{VERSION}</span>
            <span className="upd-arrow">→</span>
            <span className="upd-ver new">v{latest ?? "?"}</span>
          </div>
          <p className="inst-lede">{t("upd_lede")}</p>
        </div>

        {/* Recommended: AI coding CLI does it in one prompt. */}
        <div className="inst-ai">
          <div className="inst-ai-head">
            <span>{t("inst_ai_head")}</span>
            <span className="inst-ai-rec">{t("inst_ai_rec")}</span>
          </div>
          <p className="inst-ai-sub">{t("upd_ai_sub")}</p>
          <div className="inst-prompt-box">
            <p className="inst-prompt-text">{aiPrompt}</p>
            <CopyButton text={aiPrompt} />
          </div>
        </div>

        <div className="inst-or">{t("inst_or")}</div>

        {/* Manual: git pull + reinstall + restart. */}
        <div className="upd-manual">
          <h3>{t("upd_manual_t")}</h3>
          <p>{t("upd_manual_desc")}</p>
          <div className="inst-term">
            <div className="inst-term-bar">
              <i /> <i /> <i />
              <span className="inst-term-title">Terminal</span>
            </div>
            <div className="inst-term-body">
              <pre>
                <code>
                  {UPDATE_COMMANDS.map((c) => (
                    <span key={c} className="inst-line">
                      <span className="inst-prompt">$</span> {c}
                    </span>
                  ))}
                </code>
              </pre>
              <CopyButton text={UPDATE_COMMANDS.join("\n")} />
            </div>
          </div>
        </div>

        <div className="inst-foot">
          <a className="inst-source" href={CANONICAL_URL} target="_blank" rel="noreferrer">
            {t("ver_check")}
          </a>
          {GITHUB_URL && (
            <a
              className="inst-source"
              href={`${GITHUB_URL}/releases`}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 18 }}
            >
              {t("inst_source")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
