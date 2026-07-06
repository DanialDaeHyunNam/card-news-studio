"use client";

import { useState } from "react";
import { KEY_ENV_VARS, PROVIDER_LABELS } from "@/lib/models";
import { useLang } from "@/lib/i18n";

// Provider key rows, rendered inside the key modal. Values go straight to
// /api/keys (server writes .env.local) and are never stored client-side.
export default function KeyPanel({
  keys,
  writable,
  onSaved,
}: {
  keys: Record<string, boolean>;
  writable: boolean;
  onSaved: (envVar: string) => void;
}) {
  const { t } = useLang();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(envVar: string) {
    const value = values[envVar]?.trim();
    if (!value || saving) return;
    setSaving(envVar);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envVar, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("keys_fail"));
      setValues((v) => ({ ...v, [envVar]: "" }));
      onSaved(envVar);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("keys_fail"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="key-list">
      {!writable && (
        <p className="key-hint">{t("keys_unwritable")}</p>
      )}
      {KEY_ENV_VARS.map((envVar) => {
        const info = PROVIDER_LABELS[envVar];
        const has = keys[envVar];
        return (
          <div key={envVar} className="key-provider">
            <div className="key-provider-head">
              <span className={`key-dot ${has ? "on" : ""}`} />
              <span className="key-provider-name">{info?.label ?? envVar}</span>
              <span className="key-status">{has ? t("keys_has") : t("keys_none")}</span>
              {info && (
                <a href={info.keyUrl} target="_blank" rel="noreferrer" className="key-get">
                  {t("keys_get")}
                </a>
              )}
            </div>
            {writable && (
              <div className="key-row">
                <input
                  type="password"
                  placeholder={has ? t("keys_ph_replace") : t("keys_ph_new")}
                  value={values[envVar] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [envVar]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save(envVar);
                  }}
                />
                <button
                  className="btn primary small"
                  disabled={saving === envVar || !values[envVar]?.trim()}
                  onClick={() => void save(envVar)}
                >
                  {saving === envVar ? "…" : t("keys_save")}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <div className="key-error">{error}</div>}
      <p className="key-hint">{t("keys_hint")}</p>
    </div>
  );
}
