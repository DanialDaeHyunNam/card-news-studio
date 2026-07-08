"use client";

import type { Card, CardElement, Format, Theme } from "@/lib/types";
import { EXPORT_WIDTH, FORMATS } from "@/lib/types";
import type React from "react";

// Single source of truth for card rendering: used by the editor canvas,
// the card-strip thumbnails, and the full-resolution export node.
//
// Text is ALWAYS laid out at EXPORT_WIDTH and shrunk with a CSS transform —
// never by multiplying font sizes. Glyph advance widths don't scale linearly
// with font size, so a numerically-scaled thumbnail wraps lines differently
// from the canvas/export. A uniform transform keeps line breaks identical at
// every display size (thumbnail = canvas = exported PNG).
interface CardViewProps {
  card: Card;
  theme: Theme;
  format: Format;
  width: number;
  selectedElementId?: string | null;
  editingElementId?: string | null;
  guides?: { v: number[]; h: number[] };
  onElementPointerDown?: (e: React.PointerEvent, el: CardElement) => void;
  onElementDoubleClick?: (el: CardElement) => void;
  onResizeStart?: (e: React.PointerEvent, el: CardElement) => void;
  onBackgroundPointerDown?: () => void;
}

export function cardHeight(format: Format, width: number): number {
  const { w, h } = FORMATS[format];
  return (width * h) / w;
}

export default function CardView({
  card,
  theme,
  format,
  width,
  selectedElementId,
  editingElementId,
  guides,
  onElementPointerDown,
  onElementDoubleClick,
  onResizeStart,
  onBackgroundPointerDown,
}: CardViewProps) {
  const scale = width / EXPORT_WIDTH;
  const height = cardHeight(format, width);
  const interactive = !!onElementPointerDown;
  // Selection chrome (outline, resize handle, guides) lives inside the scaled
  // node, so it must be drawn 1/scale bigger to keep a constant on-screen size.
  const ui = 1 / scale;

  return (
    <div className="cardview" style={{ position: "relative", width, height, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: EXPORT_WIDTH,
          height: cardHeight(format, EXPORT_WIDTH),
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          background: card.background || theme.background,
          fontFamily: theme.fontFamily,
          ["--ui" as string]: ui,
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onBackgroundPointerDown?.();
        }}
      >
        {card.elements.map((el) => {
          const selected = interactive && el.id === selectedElementId;
          const base: React.CSSProperties = {
            position: "absolute",
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.w}%`,
            opacity: el.opacity,
            cursor: interactive ? "move" : undefined,
            outline: selected ? `${1.5 * ui}px solid #3b82f6` : undefined,
            outlineOffset: 2 * ui,
            touchAction: "none",
          };
          let inner: React.ReactNode;
          if (el.type === "text") {
            inner = (
              <div
                key={el.id}
                data-el-id={el.id}
                style={{
                  ...base,
                  fontSize: el.fontSize,
                  fontWeight: el.fontWeight,
                  color: el.color,
                  textAlign: el.align,
                  lineHeight: el.lineHeight,
                  fontFamily: el.fontFamily || undefined,
                  letterSpacing: el.letterSpacing !== undefined ? `${el.letterSpacing}em` : undefined,
                  fontStyle: el.italic ? "italic" : undefined,
                  textDecoration: el.underline ? "underline" : undefined,
                  whiteSpace: "pre-wrap",
                  wordBreak: "keep-all",
                  visibility: el.id === editingElementId ? "hidden" : undefined,
                }}
                onPointerDown={(e) => onElementPointerDown?.(e, el)}
                onDoubleClick={() => onElementDoubleClick?.(el)}
              >
                {el.text}
                {selected && <ResizeHandle onPointerDown={(e) => onResizeStart?.(e, el)} />}
              </div>
            );
          } else if (el.type === "shape") {
            inner = (
              <div
                key={el.id}
                data-el-id={el.id}
                style={{
                  ...base,
                  height: `${el.h}%`,
                  background: el.color,
                  borderRadius: el.radius,
                }}
                onPointerDown={(e) => onElementPointerDown?.(e, el)}
              >
                {selected && <ResizeHandle onPointerDown={(e) => onResizeStart?.(e, el)} />}
              </div>
            );
          } else {
            inner = (
              <div
                key={el.id}
                data-el-id={el.id}
                style={{
                  ...base,
                  height: `${el.h}%`,
                  borderRadius: el.radius,
                  overflow: "hidden",
                }}
                onPointerDown={(e) => onElementPointerDown?.(e, el)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={el.src}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: el.fit, pointerEvents: "none" }}
                />
                {el.dim ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: `rgba(0,0,0,${el.dim})`,
                      pointerEvents: "none",
                    }}
                  />
                ) : null}
                {selected && <ResizeHandle onPointerDown={(e) => onResizeStart?.(e, el)} />}
              </div>
            );
          }
          return inner;
        })}
        {guides?.v.map((x, i) => (
          <div key={`v${i}`} className="guide" style={{ left: `${x}%`, top: 0, bottom: 0, width: ui }} />
        ))}
        {guides?.h.map((y, i) => (
          <div key={`h${i}`} className="guide" style={{ top: `${y}%`, left: 0, right: 0, height: ui }} />
        ))}
      </div>
    </div>
  );
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      className="resize-handle"
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e);
      }}
    />
  );
}
