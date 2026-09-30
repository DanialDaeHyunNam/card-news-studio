// License + trial for OFFICIAL builds (Lemon Squeezy License API).
// Ported from ZTO (same store, same model): the app validates license keys
// itself — the License API takes the license key as its credential, so there is
// no server of ours in the loop. On a desktop app that key is the user's own,
// on their own machine; nothing to hide.
//
// ⚠️ The product check is mandatory: "valid" only means valid SOMEWHERE on Lemon
// Squeezy. We must compare the response's store/variant ids with ours, or any
// seller's key would unlock the app.
//
// Source builds (no CARDNEWS_OFFICIAL_BUILD) never gate anything — building
// from source is free, per LICENSE.
import { safeStorage } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const API = "https://api.lemonsqueezy.com/v1/licenses";

// Libertas store (all-libertas.lemonsqueezy.com), shared with ZTO.
export const LS_STORE_ID = "443985";
// Card News Studio variant ids → plan. EMPTY until the products exist on Lemon
// Squeezy (owner TODO). scripts/build-desktop.mjs refuses an OFFICIAL build
// while this is empty — with no variants the product check would be skipped.
// These ids are baked into the binary: changing them means a new release.
export const LS_VARIANTS: Record<string, Plan> = {
  // "0000000": "byo", // Card News Studio — one-time, lifetime (bring your own AI)
};
// Checkout page opened from the lock screen / license panel (owner TODO).
export const BUY_URL = "https://all-libertas.lemonsqueezy.com";

// "plus" (hosted AI through the shared proxy) is reserved for later.
export type Plan = "byo" | "plus";
export type LicenseState = "none" | "active" | "expired" | "disabled" | "wrong-product";

export interface LicenseInfo {
  state: LicenseState;
  plan?: Plan;
  keyMasked?: string;
  lastCheckedAt?: string;
  offlineUntil?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialActive: boolean;
  // Can the user generate/edit with AI right now = licensed or in trial.
  entitled: boolean;
  official: boolean;
  buyUrl: string;
  error?: string;
}

interface Stored {
  key?: string; // safeStorage ciphertext (base64)
  instanceId?: string;
  plan?: Plan;
  state?: LicenseState;
  lastCheckedAt?: string;
  trialStartedAt?: string;
}

const TRIAL_DAYS = 3;
// Offline use keeps working this long after the last successful check — we're
// stopping unlicensed use, not people on a plane.
const OFFLINE_GRACE_DAYS = 14;
const RECHECK_HOURS = 24;

const days = (n: number): number => n * 24 * 60 * 60 * 1000;

export function createLicense(file: string, official: boolean) {
  const read = (): Stored => {
    try {
      return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Stored) : {};
    } catch {
      return {};
    }
  };
  const write = (s: Stored): void => {
    try {
      writeFileSync(file, JSON.stringify(s, null, 2));
    } catch {
      /* a failed write must not stop the app */
    }
  };
  const decodeKey = (s: Stored): string => {
    if (!s.key) return "";
    try {
      return safeStorage.decryptString(Buffer.from(s.key, "base64"));
    } catch {
      return "";
    }
  };

  // The free-use clock starts at the first launch of an official build.
  const startTrial = (): void => {
    const s = read();
    if (s.trialStartedAt) return;
    write({ ...s, trialStartedAt: new Date().toISOString() });
  };

  const info = (): LicenseInfo => {
    const s = read();
    const now = Date.now();
    const trialEnds = s.trialStartedAt ? new Date(s.trialStartedAt).getTime() + days(TRIAL_DAYS) : 0;
    const trialActive = trialEnds > now;
    const checked = s.lastCheckedAt ? new Date(s.lastCheckedAt).getTime() : 0;
    const offlineUntil = checked ? checked + days(OFFLINE_GRACE_DAYS) : 0;
    const licensed = s.state === "active" && offlineUntil > now;
    const key = decodeKey(s);
    return {
      state: s.state ?? "none",
      plan: s.plan,
      keyMasked: key ? `${key.slice(0, 8)}…${key.slice(-4)}` : undefined,
      lastCheckedAt: s.lastCheckedAt,
      offlineUntil: offlineUntil ? new Date(offlineUntil).toISOString() : undefined,
      trialStartedAt: s.trialStartedAt,
      trialEndsAt: trialEnds ? new Date(trialEnds).toISOString() : undefined,
      trialActive,
      // Source builds are never gated.
      entitled: !official || licensed || trialActive,
      official,
      buyUrl: BUY_URL,
    };
  };

  // activate and validate answer in the same shape — interpret it in one place.
  const applyResponse = (
    j: {
      valid?: boolean;
      activated?: boolean;
      error?: string;
      license_key?: { status?: string };
      meta?: { store_id?: number | string; variant_id?: number | string };
      instance?: { id?: string };
    },
    key: string,
    prev: Stored,
  ): LicenseInfo => {
    const status = j.license_key?.status ?? "";
    const ok = (j.valid ?? j.activated ?? false) && status === "active";
    let state: LicenseState = ok ? "active" : status === "expired" ? "expired" : "disabled";

    // Ours? Without this any seller's key passes.
    if (ok && LS_STORE_ID && String(j.meta?.store_id ?? "") !== LS_STORE_ID) state = "wrong-product";
    const plan = LS_VARIANTS[String(j.meta?.variant_id ?? "")];
    if (ok && Object.keys(LS_VARIANTS).length > 0 && !plan) state = "wrong-product";

    const next: Stored = {
      ...prev,
      key: safeStorage.encryptString(key).toString("base64"),
      instanceId: j.instance?.id ?? prev.instanceId,
      plan: plan ?? prev.plan,
      state,
      // A FAILED check never refreshes the grace clock — a dead key must not
      // live 14 more days.
      lastCheckedAt: state === "active" ? new Date().toISOString() : prev.lastCheckedAt,
    };
    write(next);
    return { ...info(), error: state === "active" ? undefined : (j.error ?? state) };
  };

  const post = async (path: string, body: Record<string, string>): Promise<Record<string, unknown>> => {
    const r = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await r.json()) as Record<string, unknown>;
  };

  const activate = async (key: string, deviceName: string): Promise<LicenseInfo> => {
    const trimmed = key.trim();
    if (!trimmed) return { ...info(), error: "empty" };
    try {
      const j = await post("activate", { license_key: trimmed, instance_name: deviceName });
      return applyResponse(j, trimmed, read());
    } catch (e) {
      return { ...info(), error: String(e).slice(0, 160) };
    }
  };

  // Periodic re-check. Offline → quietly lean on the grace period; cutting the
  // state here would lock out anyone briefly without internet.
  const revalidate = async (force = false): Promise<LicenseInfo> => {
    const s = read();
    const key = decodeKey(s);
    if (!key) return info();
    const checked = s.lastCheckedAt ? new Date(s.lastCheckedAt).getTime() : 0;
    if (!force && Date.now() - checked < RECHECK_HOURS * 60 * 60 * 1000) return info();
    try {
      const j = await post("validate", {
        license_key: key,
        ...(s.instanceId ? { instance_id: s.instanceId } : {}),
      });
      return applyResponse(j, key, s);
    } catch {
      return info();
    }
  };

  const deactivate = async (): Promise<LicenseInfo> => {
    const s = read();
    const key = decodeKey(s);
    if (key && s.instanceId) {
      try {
        await post("deactivate", { license_key: key, instance_id: s.instanceId });
      } catch {
        /* remove locally anyway — the user asked to free this device */
      }
    }
    write({ trialStartedAt: s.trialStartedAt }); // keep the trial record (no reset loophole)
    return info();
  };

  return { info, activate, revalidate, deactivate, startTrial };
}
