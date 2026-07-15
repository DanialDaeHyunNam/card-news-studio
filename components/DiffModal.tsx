"use client";

import { Fragment, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { useLang, type DictKey } from "@/lib/i18n";

// Local-vs-browser comparison modal (pattern from ZCLIP's landing). Every cell
// states a FACT about this app's architecture — if the architecture changes,
// change the cells with it. The local column is highlighted on purpose: local
// is the better home, the browser is the fastest taste.
const ROWS: [DictKey, DictKey, DictKey][] = [
  ["diff_r1_label", "diff_r1_browser", "diff_r1_local"],
  ["diff_r2_label", "diff_r2_browser", "diff_r2_local"],
  ["diff_r3_label", "diff_r3_browser", "diff_r3_local"],
  ["diff_r4_label", "diff_r4_browser", "diff_r4_local"],
];

export default function DiffModal({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => trackEvent("diff_modal_open"), []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card diff-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("diff_title")}</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="diff-grid">
          <span className="diff-corner" aria-hidden />
          <span className="diff-col-h">{t("diff_browser_h")}</span>
          <span className="diff-col-h diff-col-h-local">{t("diff_local_h")}</span>
          {/* grid children must stay flat — a wrapper div would collapse the columns */}
          {ROWS.map(([label, browser, local]) => (
            <Fragment key={label}>
              <span className="diff-row-h">{t(label)}</span>
              <span className="diff-cell">{t(browser)}</span>
              <span className="diff-cell diff-cell-local">{t(local)}</span>
            </Fragment>
          ))}
        </div>
        <p className="diff-verdict">{t("diff_verdict")}</p>
        <div className="diff-actions">
          <button className="btn pill-white" onClick={onInstall}>
            {t("diff_install")}
          </button>
          <button className="btn ghost" onClick={onClose}>
            {t("diff_try")}
          </button>
        </div>
      </div>
    </div>
  );
}
