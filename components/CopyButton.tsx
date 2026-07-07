"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

// Copy-to-clipboard button used in the install/update guides. Styled by `.inst-copy`.
export default function CopyButton({ text }: { text: string }) {
  const { t } = useLang();
  const [done, setDone] = useState(false);
  return (
    <button
      className={`inst-copy ${done ? "ok" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked (insecure context) — user can select manually */
        }
      }}
    >
      {done ? t("inst_copied") : t("inst_copy")}
    </button>
  );
}
