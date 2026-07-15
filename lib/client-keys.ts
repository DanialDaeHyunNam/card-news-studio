// BYOK key store for the hosted deploy. On a public deployment there is no
// .env.local, so provider keys live in the USER'S browser instead: session-only
// by default (gone when the tab closes), or localStorage when they opt into
// "remember on this browser". Keys stored here are sent from the browser
// straight to the provider's API (see lib/ai-client.ts) — they never touch our
// server, and that promise is load-bearing for the disclaimer copy. Never log
// a key, never put one in a URL, never include one in an analytics event.

import { KEY_ENV_VARS } from "./models";

const PREFIX = "cardnews.key.";

function readStore(store: Storage, envVar: string): string | null {
  try {
    return store.getItem(PREFIX + envVar);
  } catch {
    return null;
  }
}

export function getClientKey(envVar: string): string | null {
  if (typeof window === "undefined") return null;
  return readStore(window.sessionStorage, envVar) ?? readStore(window.localStorage, envVar);
}

// `remember` picks the store; the other store is always cleared so a key lives
// in exactly one place (switching the checkbox moves it, not copies it).
export function setClientKey(envVar: string, value: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const target = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;
    target.setItem(PREFIX + envVar, value.trim());
    other.removeItem(PREFIX + envVar);
  } catch {
    /* storage blocked (private mode quota etc.) — the save UI surfaces failure via hasClientKey */
  }
}

export function removeClientKey(envVar: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREFIX + envVar);
    window.localStorage.removeItem(PREFIX + envVar);
  } catch {
    /* ignore */
  }
}

export const hasClientKey = (envVar: string): boolean => Boolean(getClientKey(envVar));

// True when the key is in localStorage (the user checked "remember").
export function isRemembered(envVar: string): boolean {
  if (typeof window === "undefined") return false;
  return readStore(window.localStorage, envVar) != null;
}

// Presence booleans in the same shape /api/keys GET returns, so hosted mode can
// feed the existing `keys` state without touching downstream logic.
export function clientKeyFlags(): Record<string, boolean> {
  return Object.fromEntries(KEY_ENV_VARS.map((k) => [k, hasClientKey(k)]));
}

// "sk-ant-api03-…Q4AA" — enough to recognize the key, never enough to use it.
export function maskKey(v: string): string {
  if (v.length <= 12) return "…";
  return `${v.slice(0, 10)}…${v.slice(-4)}`;
}
