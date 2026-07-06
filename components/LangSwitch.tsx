"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export default function LangSwitch() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="lang-wrap">
      <button className="btn ghost" onClick={() => setOpen((v) => !v)} title="Language">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
        </svg>
        {lang.toUpperCase()}
      </button>
      {open && (
        <div className="lang-menu" onMouseLeave={() => setOpen(false)}>
          {(
            [
              ["ko", "한국어"],
              ["en", "English"],
            ] as const
          ).map(([l, label]) => (
            <button
              key={l}
              className={lang === l ? "on" : ""}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
