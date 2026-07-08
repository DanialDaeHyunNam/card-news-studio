"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

// Shown before generating from a LONG YouTube video. The transcript gets
// truncated to ~16k chars server-side, so for long videos we let the user pick
// which time window to turn into cards instead of silently using only the start.
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LENGTHS = [10, 15, 20, 30]; // minutes

export default function SegmentPicker({
  title,
  durationSec,
  onConfirm,
  onClose,
}: {
  title: string;
  durationSec: number;
  onConfirm: (startSec: number, endSec: number) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const [startSec, setStartSec] = useState(0);
  const [lengthMin, setLengthMin] = useState(15);
  const endSec = Math.min(durationSec, startSec + lengthMin * 60);
  const maxStart = Math.max(0, durationSec - 60);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card seg-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{t("seg_title")}</span>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="seg-sub">
          <b>{title}</b>
          <br />
          {t("seg_total")} {mmss(durationSec)} · {t("seg_hint")}
        </p>

        <div className="seg-range">
          <span className="seg-badge">{mmss(startSec)}</span>
          <span className="seg-arrow">→</span>
          <span className="seg-badge new">{mmss(endSec)}</span>
          <span className="seg-dur">({lengthMin}{lang === "ko" ? "분" : " min"})</span>
        </div>

        <label className="seg-label">{t("seg_start")}</label>
        <input
          className="seg-slider"
          type="range"
          min={0}
          max={maxStart}
          step={30}
          value={Math.min(startSec, maxStart)}
          onChange={(e) => setStartSec(Number(e.target.value))}
        />

        <label className="seg-label">{t("seg_len")}</label>
        <div className="seg-lens">
          {LENGTHS.map((m) => (
            <button
              key={m}
              className={`chip ${lengthMin === m ? "on" : ""}`}
              onClick={() => setLengthMin(m)}
            >
              {m}
              {lang === "ko" ? "분" : "m"}
            </button>
          ))}
        </div>

        <div className="seg-actions">
          <button className="btn ghost" onClick={() => onConfirm(0, durationSec)}>
            {t("seg_full")}
          </button>
          <button className="btn primary" onClick={() => onConfirm(startSec, endSec)}>
            {t("seg_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
