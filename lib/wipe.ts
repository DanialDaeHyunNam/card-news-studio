// "Erase all data" — removes every cardnews.* entry from BOTH browser storages
// (projects/settings in localStorage, session-only API keys in sessionStorage).
// Filesystem projects (local dev's data/projects) are deliberately untouched:
// this wipes the BROWSER, not the machine.

const PREFIX = "cardnews.";

function wipeStore(store: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX)) doomed.push(k);
  }
  for (const k of doomed) store.removeItem(k);
}

export function wipeAllData(): void {
  if (typeof window === "undefined") return;
  try {
    wipeStore(window.localStorage);
    wipeStore(window.sessionStorage);
  } catch {
    /* storage blocked — nothing to wipe */
  }
}
