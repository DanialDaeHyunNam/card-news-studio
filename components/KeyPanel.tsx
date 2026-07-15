"use client";

import { useState } from "react";
import { KEY_ENV_VARS, MODELS, PROVIDER_LABELS } from "@/lib/models";
import { getClientKey, isRemembered, maskKey, removeClientKey, setClientKey } from "@/lib/client-keys";
import { trackEvent } from "@/lib/analytics";
import { useLang } from "@/lib/i18n";

// Same shape the server-side /api/keys enforces — printable, no whitespace.
const KEY_SHAPE = /^[\x21-\x7E]{8,300}$/;

// Provider key rows, rendered inside the key modal. Two modes:
//   - local dev: values go to /api/keys (server writes .env.local) and are
//     never stored client-side.
//   - hosted (BYOK): values stay in THIS browser — sessionStorage by default,
//     localStorage when "remember" is checked — and are sent straight to the
//     provider (lib/ai-client.ts). The disclaimer below the rows states that
//     contract; it must stay true to the implementation.
export default function KeyPanel({
  keys,
  writable,
  hosted = false,
  selectedModelId,
  onSaved,
  onRemoved,
  onLocalGuide,
}: {
  keys: Record<string, boolean>;
  writable: boolean;
  hosted?: boolean;
  selectedModelId?: string; // drives the dynamic provider name/domain in the disclaimer
  onSaved: (envVar: string) => void;
  onRemoved?: (envVar: string) => void;
  onLocalGuide?: () => void;
}) {
  const { t } = useLang();
  const [values, setValues] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(KEY_ENV_VARS.map((k) => [k, isRemembered(k)])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped after hosted save/remove so masked previews re-read storage.
  const [, setRev] = useState(0);

  async function save(envVar: string) {
    const value = values[envVar]?.trim();
    if (!value || saving) return;
    setError(null);

    if (hosted) {
      if (!KEY_SHAPE.test(value)) {
        setError(t("keys_shape"));
        return;
      }
      setClientKey(envVar, value, remember[envVar] ?? false);
      if (!getClientKey(envVar)) {
        setError(t("keys_store_fail"));
        return;
      }
      setValues((v) => ({ ...v, [envVar]: "" }));
      setRev((r) => r + 1);
      // Provider NAME only — never key material (see lib/analytics.ts rules).
      trackEvent("key_save", { provider: envVar, mode: "byok" });
      onSaved(envVar);
      return;
    }

    setSaving(envVar);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envVar, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("keys_fail"));
      setValues((v) => ({ ...v, [envVar]: "" }));
      trackEvent("key_save", { provider: envVar, mode: "env" });
      onSaved(envVar);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("keys_fail"));
    } finally {
      setSaving(null);
    }
  }

  function toggleRemember(envVar: string, next: boolean) {
    setRemember((r) => ({ ...r, [envVar]: next }));
    // A stored key moves between session/local storage right away, so the
    // checkbox always reflects where the key actually lives.
    const existing = getClientKey(envVar);
    if (existing) setClientKey(envVar, existing, next);
  }

  const canEdit = hosted || writable;
  const selected = MODELS.find((m) => m.id === selectedModelId) ?? MODELS[0];
  const selInfo = PROVIDER_LABELS[selected.envVar];

  return (
    <div className="key-list">
      {!canEdit && <p className="key-hint">{t("keys_unwritable")}</p>}
      {KEY_ENV_VARS.map((envVar) => {
        const info = PROVIDER_LABELS[envVar];
        const has = keys[envVar];
        const stored = hosted ? getClientKey(envVar) : null;
        return (
          <div key={envVar} className="key-provider">
            <div className="key-provider-head">
              <span className={`key-dot ${has ? "on" : ""}`} />
              <span className="key-provider-name">{info?.label ?? envVar}</span>
              <span className="key-status">
                {has
                  ? hosted
                    ? isRemembered(envVar)
                      ? t("keys_has_local")
                      : t("keys_has_session")
                    : t("keys_has")
                  : t("keys_none")}
              </span>
              {info && (
                <a href={info.keyUrl} target="_blank" rel="noreferrer" className="key-get">
                  {t("keys_get")}
                </a>
              )}
            </div>
            {hosted && stored && (
              <div className="key-stored-row">
                <code className="key-mask">{maskKey(stored)}</code>
                <button
                  className="btn ghost small key-remove"
                  onClick={() => {
                    removeClientKey(envVar);
                    setRev((r) => r + 1);
                    onRemoved?.(envVar);
                  }}
                >
                  {t("keys_remove")}
                </button>
              </div>
            )}
            {canEdit && (
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
            {hosted && (
              <label className="key-remember">
                <input
                  type="checkbox"
                  checked={remember[envVar] ?? false}
                  onChange={(e) => toggleRemember(envVar, e.target.checked)}
                />
                {t("keys_remember")}
              </label>
            )}
          </div>
        );
      })}
      {error && <div className="key-error">{error}</div>}

      {hosted ? (
        // The disclaimer is a CONTRACT with lib/ai-client.ts, not marketing copy:
        // keys live only in this browser and travel only to the provider domain.
        // If an implementation change would break a sentence here, change the
        // implementation back — never soften the sentence.
        <div className="key-disclaimer">
          <p>
            {t("keyd_line1").replace("{domain}", selInfo?.domain ?? "")}{" "}
            {selInfo?.spendUrl ? (
              <a href={selInfo.spendUrl} target="_blank" rel="noreferrer">
                {t("keyd_line2")}
              </a>
            ) : (
              t("keyd_line2")
            )}
          </p>
          <p>{t("keyd_line3").replace("{provider}", selInfo?.label ?? "")}</p>
          <p>
            {onLocalGuide ? (
              <button className="key-local-link" onClick={onLocalGuide}>
                {t("keyd_local")} →
              </button>
            ) : (
              <span>{t("keyd_local")}</span>
            )}
            {" · "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              {t("keyd_privacy")}
            </a>
          </p>
        </div>
      ) : (
        <p className="key-hint">{t("keys_hint")}</p>
      )}
    </div>
  );
}
