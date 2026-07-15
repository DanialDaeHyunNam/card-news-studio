// Thin wrapper over Vercel Web Analytics custom events. ALL event calls go
// through here so the rules live in one place:
//   - Event props say WHAT was clicked, never what was typed — no topics, no
//     card text, no key material. Model/template IDs and format labels only.
//   - Custom events are a Vercel Pro feature; on the current Hobby plan they
//     are dropped server-side. This wrapper stays silent either way (never a
//     console error) and lights up automatically if the team upgrades.
// Page views (<Analytics/> in app/layout.tsx) work on every plan.

import { track } from "@vercel/analytics";

type Props = Record<string, string | number | boolean>;

export function trackEvent(name: string, props?: Props): void {
  try {
    track(name, props);
  } catch {
    /* analytics must never break the app */
  }
}
