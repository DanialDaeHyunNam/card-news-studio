"use client";

// Shared shell for the plain-text site pages (/terms, /refunds). Same look as
// /privacy. Each paragraph is [ko, en]; the English text is the binding one.
import { LangProvider, useLang } from "@/lib/i18n";
import LogoMark from "./LogoMark";
import LangSwitch from "./LangSwitch";

export type LegalSection = { h: [string, string]; body: [string, string][] };

function Body({ title, updated, sections }: { title: [string, string]; updated: string; sections: LegalSection[] }) {
  const { lang } = useLang();
  const i = lang === "ko" ? 0 : 1;
  return (
    <div className="privacy-page">
      <header className="home-nav">
        <a className="logo" href="/">
          <LogoMark size={22} /> Card News Studio
        </a>
        <div className="nav-actions">
          <LangSwitch />
        </div>
      </header>
      <main className="privacy-main">
        <h1>{title[i]}</h1>
        <p className="privacy-updated">
          {lang === "ko" ? "마지막 갱신" : "Last updated"}: {updated}
          {lang === "ko" && " · 영어 원문이 기준이며, 한국어는 이해를 돕기 위한 번역입니다."}
        </p>
        {sections.map((s) => (
          <section key={s.h[1]}>
            <h2>{s.h[i]}</h2>
            {s.body.map((b, j) => (
              <p key={j}>{b[i]}</p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

export default function LegalPage(props: { title: [string, string]; updated: string; sections: LegalSection[] }) {
  return (
    <LangProvider>
      <Body {...props} />
    </LangProvider>
  );
}
