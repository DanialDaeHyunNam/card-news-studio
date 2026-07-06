"use client";

import { GITHUB_URL, SOCIAL } from "@/lib/site";
import { useLang } from "@/lib/i18n";
import LogoMark from "./LogoMark";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="logo">
              <LogoMark size={22} /> Card News Studio
            </div>
            <p>
              {t("footer_desc_1")}
              <br />
              {t("footer_desc_2")}
            </p>
          </div>

          <div className="footer-col">
            <h4>Project</h4>
            {GITHUB_URL ? (
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                {t("footer_star")}
              </a>
            ) : (
              <span className="footer-soon">
                {t("footer_star_soon_1")}
                <br />
                {t("footer_star_soon_2")}
              </span>
            )}
            <span className="footer-dim">MIT License</span>
          </div>

          <div className="footer-col">
            <h4>{t("footer_follow")}</h4>
            <a href={SOCIAL.threads.url} target="_blank" rel="noreferrer">
              <span className="footer-icon">@</span> Threads {SOCIAL.threads.handle}
            </a>
            <a href={SOCIAL.x.url} target="_blank" rel="noreferrer">
              <span className="footer-icon"><XIcon /></span> X {SOCIAL.x.handle}
            </a>
            <span className="footer-dim">{t("footer_follow_note")}</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Card News Studio. All rights reserved.</span>
          <div className="footer-socials">
            <a href={SOCIAL.threads.url} target="_blank" rel="noreferrer" title="Threads">
              <span className="footer-icon">@</span>
            </a>
            <a href={SOCIAL.x.url} target="_blank" rel="noreferrer" title="X">
              <span className="footer-icon"><XIcon /></span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
