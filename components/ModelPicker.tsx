"use client";

import { useRef, useState } from "react";
import { MODELS, PROVIDER_ORDER, PROVIDER_NAMES, resolveModel, priceLabel, type ModelInfo } from "@/lib/models";
import { useLang } from "@/lib/i18n";
import { useClickOutside } from "@/lib/hooks";

interface ModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  keys: Record<string, boolean> | null; // connected-key booleans by envVar; null = unknown
  onConnectKey?: () => void; // opens the key modal when a keyless model is picked
  align?: "left" | "right";
  disabled?: boolean;
}

// shadcn-style grouped model dropdown: flagship models show by default, the rest
// live behind "All models". Each row carries a price + spec line and a speed
// meter so you can pick by cost/speed at a glance.
export default function ModelPicker({ value, onChange, keys, onConnectKey, align = "left", disabled }: ModelPickerProps) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false), open);

  const current = MODELS.find((m) => m.id === value) ?? resolveModel(value);
  const currentNoKey = keys ? !keys[current.envVar] : false;

  function pick(m: ModelInfo) {
    onChange(m.id);
    setOpen(false);
    // Picking a model whose key isn't connected nudges the key modal open.
    if (keys && !keys[m.envVar]) onConnectKey?.();
  }

  const groups = PROVIDER_ORDER.map((provider) => {
    const all = MODELS.filter((m) => m.provider === provider);
    const models = all.filter((m) => showAll || m.tier === "recommended" || m.id === value);
    return { provider, models, envVar: all[0]?.envVar ?? "" };
  }).filter((g) => g.models.length > 0);

  return (
    <div className="mp-wrap" ref={wrapRef}>
      <button
        className="mp-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title={t("ed_model_title")}
      >
        <span className="mp-trigger-name">{current.short}</span>
        {currentNoKey && <span className="mp-tag warn">{t("keys_none")}</span>}
        <svg className="mp-chev" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
          <div className={`mp-menu ${align}`}>
            <div className="mp-scroll">
              {groups.map((g) => {
                const hasKey = keys ? !!keys[g.envVar] : true;
                return (
                  <div className="mp-group" key={g.provider}>
                    <div className="mp-group-head">
                      <span>{PROVIDER_NAMES[g.provider]}</span>
                      {keys &&
                        (hasKey ? (
                          <span className="mp-dot on" title={t("keys_has")} />
                        ) : (
                          <button
                            className="mp-connect"
                            onClick={() => {
                              setOpen(false);
                              onConnectKey?.();
                            }}
                          >
                            {t("mp_connect")}
                          </button>
                        ))}
                    </div>
                    {g.models.map((m) => {
                      const noKey = keys ? !keys[m.envVar] : false;
                      return (
                        <button
                          key={m.id}
                          className={`mp-item ${m.id === value ? "sel" : ""} ${noKey ? "nokey" : ""}`}
                          onClick={() => pick(m)}
                        >
                          <span className="mp-check">{m.id === value ? "✓" : ""}</span>
                          <span className="mp-body">
                            <span className="mp-name">
                              {m.short}
                              {noKey && <span className="mp-tag warn">{t("keys_none")}</span>}
                            </span>
                            <span className="mp-spec">
                              {priceLabel(m)} · {m.note[lang === "ko" ? 0 : 1]}
                            </span>
                          </span>
                          <span className="mp-speed" title={`${t("mp_speed")}: ${m.speed}/3`}>
                            {[1, 2, 3].map((i) => (
                              <i key={i} className={i <= m.speed ? "on" : ""} />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <button className="mp-toggle" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t("mp_less") : t("mp_more")}
            </button>
          </div>
      )}
    </div>
  );
}
