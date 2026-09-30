"use client";

// Desktop-app-only UI, modelled on ZTO: the "source" badge beside the logo,
// the plan chip, the version line that doubles as the update control, the
// Settings modal (license · updates · AI · language · data) and the lock gate
// for official builds whose free period ended. Everything renders nothing on
// the web and in `bun dev` (no window.cardnewsDesktop there).
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { daysLeft, getDesktop, useDesktopStatus, type DesktopLicense, type DesktopUpdate } from "@/lib/desktop";
import KeyPanel from "./KeyPanel";
import LangSwitch from "./LangSwitch";

// ---------- logo badge ----------
// Source builds say so — next to the name, like ZTO. Also retitles the window.
export function SourceBadge() {
  const { t } = useLang();
  const { license } = useDesktopStatus();
  useEffect(() => {
    if (license) document.title = license.official ? "Card News Studio" : t("desk_title_source");
  }, [license, t]);
  if (!license || license.official) return null;
  return <span className="logo-badge">{t("desk_source_badge")}</span>;
}

// ---------- nav items: plan chip · version/update · settings ----------
export function DesktopNav() {
  const { t } = useLang();
  const { license, update } = useDesktopStatus();
  const [settings, setSettings] = useState(false);
  if (!getDesktop()) return null;

  let plan: React.ReactNode = null;
  if (license) {
    if (license.state === "active" && license.plan) {
      plan = (
        <button className={`plan-chip ${license.plan}`} onClick={() => setSettings(true)} title={t("desk_plan_title")}>
          {license.plan === "plus" ? "Plus" : "Studio"}
        </button>
      );
    } else if (license.official) {
      // Source builds get no trial chip — there is no clock, it would be a lie.
      plan = license.trialActive ? (
        <button className="plan-chip trial" onClick={() => setSettings(true)} title={t("desk_plan_title")}>
          {t("desk_plan_trial").replace("{d}", String(daysLeft(license.trialEndsAt)))}
        </button>
      ) : (
        <button className="plan-chip over" onClick={() => setSettings(true)} title={t("desk_plan_title")}>
          {t("desk_plan_over")}
        </button>
      );
    }
  }

  return (
    <>
      {plan}
      <UpdateChip update={update} />
      <button className="btn ghost" onClick={() => setSettings(true)} title={t("desk_settings")}>
        ⚙ {t("desk_settings")}
      </button>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </>
  );
}

// The version line IS the update control: click to check, progress beside it,
// and once downloaded the same spot becomes a button that needs TWO clicks
// (the second restarts the app) — the confirm resets after 6s.
function UpdateChip({ update: st }: { update: DesktopUpdate | null }) {
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  const s = st;

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 6000);
    return () => clearTimeout(id);
  }, [confirming]);

  if (!s) return null;
  const downloading = s.phase === "available" || s.phase === "downloading";
  const ready = s.phase === "ready";
  const d = getDesktop();

  return (
    <span className="version-row">
      {!(ready && confirming) && (
        <button
          className="btn ghost ver-chip"
          disabled={!!s.disabled || s.phase === "checking" || downloading || ready}
          onClick={() => void d?.update.check()}
          title={s.disabled ? "" : t("desk_ver_check")}
        >
          {s.phase === "checking" ? t("desk_ver_checking") : `v${s.version}`}
        </button>
      )}
      {downloading && (
        <span className="version-progress" title={t("desk_upd_dl").replace("{p}", String(s.percent ?? 0))}>
          ↓ {s.percent ?? 0}%
        </span>
      )}
      {ready && (
        <button
          className={`btn ver-chip update${confirming ? " confirm" : ""}`}
          onClick={() => (confirming ? void d?.update.install() : setConfirming(true))}
          title={confirming ? t("desk_upd_confirm") : t("desk_upd_ready").replace("{v}", s.newVersion ?? "")}
        >
          {confirming ? `↻ ${t("desk_upd_confirm_short")}` : `↓ v${s.newVersion ?? ""}`}
        </button>
      )}
    </span>
  );
}

// ---------- settings ----------
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("desk_settings")}</span>
          <button className="modal-close" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <LicenseCard />
        <UpdateCard />
        <AiCard />
        <div className="settings-card">
          <h3 className="settings-h">{t("set_lang_title")}</h3>
          <LangSwitch />
        </div>
        <DataCard />
      </div>
    </div>
  );
}

export function LicenseCard({ autoFocus = false }: { autoFocus?: boolean }) {
  const { t } = useLang();
  const { license: info, setLicense } = useDesktopStatus();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const d = getDesktop();

  const activate = async () => {
    if (!d || !draft.trim()) return;
    setBusy(true);
    const r = await d.license.activate(draft.trim());
    setLicense(r);
    setBusy(false);
    if (r.state === "active") setDraft("");
  };
  const remove = async () => {
    if (!d) return;
    setBusy(true);
    setLicense(await d.license.deactivate());
    setBusy(false);
  };
  const errText = (l: DesktopLicense): string | null => {
    if (!l.error) return null;
    if (l.error === "wrong-product") return t("set_lic_err_product");
    if (l.error === "empty") return t("set_lic_err_empty");
    return t("set_lic_err_invalid");
  };

  return (
    <div className="settings-card">
      <h3 className="settings-h">{t("set_lic_title")}</h3>
      <p className="settings-intro">{t("set_lic_intro")}</p>
      {!info ? (
        <p className="settings-intro">…</p>
      ) : info.state === "active" ? (
        <div className="lic-row">
          <span className="status-chip ok">{t("set_lic_active")}</span>
          <code className="cred-path">{info.keyMasked}</code>
          {info.plan && <span className="status-chip">{info.plan === "plus" ? "Plus" : "Studio"}</span>}
          <button className="btn small ghost" disabled={busy} onClick={remove}>
            {t("set_lic_remove")}
          </button>
        </div>
      ) : (
        <>
          <div className="lic-row">
            {!info.official ? (
              <span className="status-chip ok">{t("set_lic_source")}</span>
            ) : info.trialActive ? (
              <span className="status-chip warn">
                {t("set_lic_trial_left").replace("{d}", String(daysLeft(info.trialEndsAt)))}
              </span>
            ) : (
              <span className="status-chip off">{t("set_lic_trial_over")}</span>
            )}
          </div>
          {/* Source builds need no key — the input only shows on official builds. */}
          {info.official && (
            <>
              <div className="lic-row">
                <input
                  className="input lic-input"
                  placeholder={t("set_lic_placeholder")}
                  value={draft}
                  autoFocus={autoFocus}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void activate()}
                />
                <button className="btn primary small" disabled={!draft.trim() || busy} onClick={activate}>
                  {busy ? t("set_lic_checking") : t("set_lic_activate")}
                </button>
              </div>
              {errText(info) && <p className="hero-error">{errText(info)}</p>}
              <div className="lic-row">
                <button className="btn small ghost" onClick={() => void d?.openExternal(info.buyUrl)}>
                  {t("set_lic_buy")}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {/* Only once re-validation is actually failing (grace refills daily when
          online, so showing it always reads like a countdown that never moves). */}
      {info?.state === "active" && info.offlineUntil && daysLeft(info.offlineUntil) <= 12 && (
        <p className="settings-intro">{t("set_lic_offline").replace("{d}", String(daysLeft(info.offlineUntil)))}</p>
      )}
    </div>
  );
}

function UpdateCard() {
  const { t } = useLang();
  const { update: st, license } = useDesktopStatus();
  const d = getDesktop();

  const label = (): string => {
    if (!st) return "…";
    if (st.disabled) return license?.official ? t("set_upd_off") : t("set_upd_dev");
    switch (st.phase) {
      case "checking":
        return t("set_upd_checking");
      case "available":
        return t("set_upd_found").replace("{v}", st.newVersion ?? "");
      case "downloading":
        return t("set_upd_dl").replace("{p}", String(st.percent ?? 0));
      case "ready":
        return t("set_upd_ready").replace("{v}", st.newVersion ?? "");
      case "error":
        return t("set_upd_error");
      default:
        return t("set_upd_latest");
    }
  };

  return (
    <div className="settings-card">
      <h3 className="settings-h">{t("set_upd_title")}</h3>
      <div className="lic-row">
        <span className="status-chip">v{st?.version ?? ""}</span>
        <span className="settings-intro inline">{label()}</span>
        {st?.phase === "ready" ? (
          <button className="btn primary small" onClick={() => void d?.update.install()}>
            {t("set_upd_install")}
          </button>
        ) : (
          !st?.disabled && (
            <button
              className="btn small ghost"
              disabled={st?.phase === "checking" || st?.phase === "downloading"}
              onClick={() => void d?.update.check()}
            >
              {t("set_upd_check")}
            </button>
          )
        )}
      </div>
      {/* The reason only shows here — a banner would alarm on every feed hiccup. */}
      {st?.phase === "error" && st.error && <p className="hero-error">{st.error}</p>}
    </div>
  );
}

function AiCard() {
  const { t } = useLang();
  const [keys, setKeys] = useState<Record<string, boolean> | null>(null);
  const [writable, setWritable] = useState(false);
  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((j) => {
        setKeys(j.keys ?? {});
        setWritable(!!j.writable);
      })
      .catch(() => setKeys({}));
  }, []);
  return (
    <div className="settings-card">
      <h3 className="settings-h">{t("set_ai_title")}</h3>
      <p className="settings-intro">{t("set_ai_intro")}</p>
      {keys && (
        <KeyPanel
          keys={keys}
          writable={writable}
          onSaved={(v) => setKeys({ ...keys, [v]: true })}
          onRemoved={(v) => setKeys({ ...keys, [v]: false })}
        />
      )}
    </div>
  );
}

function DataCard() {
  const { t } = useLang();
  const d = getDesktop();
  const [dir, setDir] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    void d?.info().then((i) => setDir(i.dataDir));
  }, [d]);

  // Two-step confirm; the armed state releases itself after 3s.
  const wipe = async () => {
    if (!d) return;
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    setBusy(true);
    await d.wipeData();
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="settings-card">
      <h3 className="settings-h">{t("set_data_title")}</h3>
      <p className="settings-intro">{t("set_data_intro")}</p>
      {dir && (
        <div className="lic-row">
          <span className="status-chip">{t("set_data_path")}</span>
          <code className="cred-path">{dir}</code>
          <button className="btn small ghost" onClick={() => void d?.openDataFolder()}>
            {t("set_data_open")}
          </button>
        </div>
      )}
      <p className="settings-intro">{t("set_data_keeps")}</p>
      {done ? (
        <div className="lic-row">
          <span className="status-chip ok">{t("set_data_done")}</span>
          <button className="btn primary small" onClick={() => void d?.relaunch()}>
            {t("set_data_restart")}
          </button>
        </div>
      ) : (
        <button className={`btn small danger${armed ? " armed" : ""}`} disabled={busy} onClick={wipe}>
          {armed ? t("set_data_wipe_sure") : t("set_data_wipe")}
        </button>
      )}
    </div>
  );
}

// ---------- lock gate (official builds, free period over) ----------
// Not a hostage screen: "Just browse" dismisses it for this session and leaves
// a banner — projects stay viewable and exportable; only the AI routes refuse
// (402, lib/runtime.ts isEntitled).
export function DesktopGate() {
  const { t } = useLang();
  const { license } = useDesktopStatus();
  const [dismissed, setDismissed] = useState(false);
  const [entering, setEntering] = useState(false);
  const d = getDesktop();
  if (!d || !license || !license.official || license.entitled) return null;

  if (dismissed && !entering) {
    return (
      <div className="gate-banner">
        <span>{t("gate_banner")}</span>
        <button className="btn small ghost" onClick={() => setEntering(true)}>
          {t("gate_enter")}
        </button>
        <button className="btn small primary" onClick={() => void d.openExternal(license.buyUrl)}>
          {t("gate_cta")}
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay gate-overlay">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("gate_title")}</span>
        </div>
        <p className="settings-intro">{t("gate_desc")}</p>
        <LicenseCard autoFocus />
        <div className="lic-row gate-actions">
          <button
            className="btn small ghost"
            onClick={() => {
              setDismissed(true);
              setEntering(false);
            }}
          >
            {t("gate_browse")}
          </button>
        </div>
      </div>
    </div>
  );
}
