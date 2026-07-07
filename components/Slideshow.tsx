"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { FORMATS } from "@/lib/types";
import CardView from "./CardView";

// Fullscreen carousel preview: flip through the cards with the arrows, the dots,
// or ← / → keys; Esc or a backdrop click closes.
export default function Slideshow({
  project,
  start,
  onClose,
}: {
  project: Project;
  start: number;
  onClose: () => void;
}) {
  const n = project.cards.length;
  const [idx, setIdx] = useState(Math.min(Math.max(0, start), n - 1));
  const [width, setWidth] = useState(360);

  // Fit the card to the viewport (leave room for arrows/counter).
  useEffect(() => {
    const compute = () => {
      const { w, h } = FORMATS[project.format];
      const availH = window.innerHeight * 0.82;
      const availW = Math.min(window.innerWidth * 0.6, 640);
      setWidth(Math.max(220, Math.min((availH * w) / h, availW)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [project.format]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % n);
      else if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + n) % n);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, onClose]);

  const card = project.cards[idx];
  if (!card) return null;

  return (
    <div className="show-overlay" onClick={onClose}>
      <button className="show-close" onClick={onClose} title="Esc">
        ✕
      </button>

      <button
        className="show-nav prev"
        disabled={n < 2}
        onClick={(e) => {
          e.stopPropagation();
          setIdx((i) => (i - 1 + n) % n);
        }}
      >
        ‹
      </button>

      <div className="show-stage" onClick={(e) => e.stopPropagation()}>
        <div key={idx} className="show-card">
          <CardView card={card} theme={project.theme} format={project.format} width={width} />
        </div>
      </div>

      <button
        className="show-nav next"
        disabled={n < 2}
        onClick={(e) => {
          e.stopPropagation();
          setIdx((i) => (i + 1) % n);
        }}
      >
        ›
      </button>

      <div className="show-footer" onClick={(e) => e.stopPropagation()}>
        <div className="show-counter">
          {idx + 1} / {n}
        </div>
        {n > 1 && (
          <div className="show-dots">
            {project.cards.map((c, i) => (
              <button
                key={c.id}
                className={i === idx ? "on" : ""}
                aria-label={`card ${i + 1}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
