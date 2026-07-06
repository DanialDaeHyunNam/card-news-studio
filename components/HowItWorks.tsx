"use client";

// "How it works" — a looping, pure-CSS product demo (no video files).
// Panel A: topic → Claude drafts cards (+ structured ops). Panel B: canvas
// editing with snap guide + AI chat edit. Keyframes live in globals.css,
// all synced to one 10s loop.
import { useLang } from "@/lib/i18n";
export default function HowItWorks() {
  const { t } = useLang();
  return (
    <section className="how">
      <div className="overline">HOW IT WORKS</div>
      <h2>{t("how_h2")}</h2>
      <p className="how-sub">{t("how_sub")}</p>

      <div className="how-grid">
        {/* Panel A — AI drafts the set */}
        <div className="demo-panel">
          <div className="demo-window">
            <div className="demo-prompt">
              <span className="demo-typing">{t("demo_typing")}</span>
              <span className="demo-caret" />
            </div>
            <div className="demo-cards">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`demo-mini demo-mini-${n}`}>
                  <i className="demo-line demo-line-accent" />
                  <i className="demo-line demo-line-big" />
                  <i className="demo-line demo-line-big short" />
                  <i className="demo-line" />
                </div>
              ))}
            </div>
            <div className="demo-op">{`{ "op": "add_card" } ✓`}</div>
          </div>
          <div className="demo-caption">
            <strong>{t("how_cap1_t")}</strong>
            {t("how_cap1_b")}
          </div>
        </div>

        {/* Panel B — canvas editing with snap + chat */}
        <div className="demo-panel">
          <div className="demo-window demo-canvas">
            <div className="demo-card">
              <i className="demo-guide" />
              <div className="demo-title">{t("demo_title_txt")}</div>
              <i className="demo-line demo-line-big demo-fixed1" />
              <i className="demo-line demo-fixed2" />
            </div>
            <div className="demo-chat">{t("demo_chat")}</div>
          </div>
          <div className="demo-caption">
            <strong>{t("how_cap2_t")}</strong>
            {t("how_cap2_b")}
          </div>
        </div>
      </div>
    </section>
  );
}
