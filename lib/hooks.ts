import { useEffect, useState, type RefObject } from "react";
import { CANONICAL_URL, VERSION, isNewerVersion } from "./site";

// Checks whether a newer version has been deployed. Only runs on a local copy
// (the hosted deploy IS the latest, so it never self-checks) — it fetches the
// canonical deployment's /api/version and compares. Fails silently if offline.
export function useUpdateCheck(hosted: boolean) {
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    if (hosted) return;
    let alive = true;
    fetch(`${CANONICAL_URL}/api/version`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && typeof d?.version === "string") setLatest(d.version);
      })
      .catch(() => {
        /* offline or blocked — no update prompt, no error */
      });
    return () => {
      alive = false;
    };
  }, [hosted]);
  return { latest, current: VERSION, hasUpdate: latest != null && isNewerVersion(latest, VERSION) };
}

// True when running on a public deployment (Vercel), where the tool can't
// actually run — API keys and projects only exist on the user's own machine.
// Read from the `data-hosted` attribute `app/layout.tsx` stamps on <html>
// server-side, so it's correct on the first client render (no flash). The app
// is fully client-rendered, so the lazy initializer has no hydration concern.
export function useHosted() {
  const [hosted] = useState(
    () => typeof document !== "undefined" && document.documentElement.dataset.hosted === "1",
  );
  return hosted;
}

// Close a popover when the user points down anywhere outside `ref`. The ref must
// wrap BOTH the trigger and the menu, so clicking the trigger counts as "inside"
// (its own onClick handles the toggle). Only listens while `active` is true.
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: Event) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onOutside();
    };
    // Capture phase so it fires before the target's own handlers.
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [ref, onOutside, active]);
}
