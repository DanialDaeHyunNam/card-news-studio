"use client";

import { useRef } from "react";
import type { Card, CardElement, Project, Theme } from "@/lib/types";
import { DEFAULT_FONT, SERIF_FONT } from "@/lib/types";
import { newId } from "@/lib/ops";
import { fileToAttachment } from "@/lib/image";
import { useLang } from "@/lib/i18n";

interface InspectorProps {
  project: Project;
  card: Card;
  element: CardElement | null;
  beginEdit: () => void; // push undo snapshot before a series of tweaks
  onPatchElement: (patch: Record<string, unknown>, withHistory?: boolean) => void;
  onPatchCard: (patch: Partial<Card>) => void;
  onPatchTheme: (patch: Partial<Theme>) => void;
  onRemoveElement: () => void;
  onAddElement: (el: CardElement) => void;
}

export default function Inspector({
  project,
  card,
  element,
  beginEdit,
  onPatchElement,
  onPatchCard,
  onPatchTheme,
  onRemoveElement,
  onAddElement,
}: InspectorProps) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  async function addImage(file: File) {
    const att = await fileToAttachment(file);
    // Fit the image into ~60% of the card width, preserving aspect ratio.
    const cardRatio = project.format === "1:1" ? 1 : project.format === "4:5" ? 1350 / 1080 : 1920 / 1080;
    const w = 60;
    const h = (w * (att.height / att.width)) / cardRatio;
    onAddElement({
      id: newId(),
      type: "image",
      x: 20,
      y: 20,
      w,
      h: Math.min(h, 70),
      src: att.dataUrl,
      fit: "cover",
      radius: 0,
    });
  }

  return (
    <aside className="inspector">
      <div className="panel-title">{t("insp_title")}</div>

      <div className="field-row add-buttons">
        <button
          className="btn small"
          onClick={() =>
            onAddElement({
              id: newId(),
              type: "text",
              x: 8,
              y: 45,
              w: 84,
              text: "텍스트",
              fontSize: 48,
              fontWeight: 700,
              color: project.theme.textColor,
              align: "center",
              lineHeight: 1.35,
            })
          }
        >
          {t("insp_add_text")}
        </button>
        <button
          className="btn small"
          onClick={() =>
            onAddElement({
              id: newId(),
              type: "shape",
              x: 8,
              y: 50,
              w: 20,
              h: 0.8,
              color: project.theme.accent,
              radius: 4,
            })
          }
        >
          {t("insp_add_shape")}
        </button>
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          {t("insp_add_image")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void addImage(f);
            e.target.value = "";
          }}
        />
      </div>

      {element ? (
        <>
          {element.type === "text" && (
            <>
              <label className="field">
                <span>{t("insp_content")}</span>
                <textarea
                  rows={3}
                  value={element.text}
                  onFocus={beginEdit}
                  onChange={(e) => onPatchElement({ text: e.target.value })}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>{t("insp_size")}</span>
                  <input
                    type="number"
                    value={element.fontSize}
                    onFocus={beginEdit}
                    onChange={(e) => onPatchElement({ fontSize: Number(e.target.value) || element.fontSize })}
                  />
                </label>
                <label className="field">
                  <span>{t("insp_weight")}</span>
                  <select
                    value={element.fontWeight}
                    onChange={(e) => onPatchElement({ fontWeight: Number(e.target.value) }, true)}
                  >
                    <option value={400}>Regular</option>
                    <option value={600}>SemiBold</option>
                    <option value={700}>Bold</option>
                    <option value={800}>ExtraBold</option>
                    <option value={900}>Black</option>
                  </select>
                </label>
              </div>
              <div className="field-row">
                <ColorField label={t("insp_color")} value={element.color} onBegin={beginEdit} onChange={(v) => onPatchElement({ color: v })} />
                <label className="field">
                  <span>{t("insp_lh")}</span>
                  <input
                    type="number"
                    step={0.05}
                    value={element.lineHeight}
                    onFocus={beginEdit}
                    onChange={(e) => onPatchElement({ lineHeight: Number(e.target.value) || element.lineHeight })}
                  />
                </label>
                <label className="field">
                  <span>{t("insp_ls")}</span>
                  <input
                    type="number"
                    step={0.01}
                    value={element.letterSpacing ?? 0}
                    onFocus={beginEdit}
                    onChange={(e) => onPatchElement({ letterSpacing: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <label className="field">
                <span>{t("insp_font")}</span>
                <select
                  value={element.fontFamily ?? ""}
                  onChange={(e) => onPatchElement({ fontFamily: e.target.value }, true)}
                >
                  <option value="">{t("insp_font_theme")}</option>
                  <option value={DEFAULT_FONT}>{t("insp_font_sans")}</option>
                  <option value={SERIF_FONT}>{t("insp_font_serif")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("insp_align")}</span>
                <div className="segmented">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      className={element.align === a ? "on" : ""}
                      onClick={() => onPatchElement({ align: a }, true)}
                    >
                      {a === "left" ? t("insp_left") : a === "center" ? t("insp_center") : t("insp_right")}
                    </button>
                  ))}
                </div>
              </label>
            </>
          )}

          {element.type === "shape" && (
            <div className="field-row">
              <ColorField label={t("insp_color")} value={element.color} onBegin={beginEdit} onChange={(v) => onPatchElement({ color: v })} />
              <label className="field">
                <span>{t("insp_radius")}</span>
                <input
                  type="number"
                  value={element.radius}
                  onFocus={beginEdit}
                  onChange={(e) => onPatchElement({ radius: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          )}

          {element.type === "image" && (
            <div className="field-row">
              <label className="field">
                <span>{t("insp_fit")}</span>
                <select value={element.fit} onChange={(e) => onPatchElement({ fit: e.target.value }, true)}>
                  <option value="cover">{t("insp_fit_cover")}</option>
                  <option value="contain">{t("insp_fit_contain")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("insp_radius")}</span>
                <input
                  type="number"
                  value={element.radius}
                  onFocus={beginEdit}
                  onChange={(e) => onPatchElement({ radius: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          )}

          <div className="field-row">
            <label className="field">
              <span>X %</span>
              <input
                type="number"
                value={Math.round(element.x * 10) / 10}
                onFocus={beginEdit}
                onChange={(e) => onPatchElement({ x: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Y %</span>
              <input
                type="number"
                value={Math.round(element.y * 10) / 10}
                onFocus={beginEdit}
                onChange={(e) => onPatchElement({ y: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>W %</span>
              <input
                type="number"
                value={Math.round(element.w * 10) / 10}
                onFocus={beginEdit}
                onChange={(e) => onPatchElement({ w: Number(e.target.value) })}
              />
            </label>
          </div>

          <button className="btn danger" onClick={onRemoveElement}>
            {t("insp_delete")}
          </button>
        </>
      ) : (
        <>
          <div className="panel-subtitle">{t("insp_card_bg")}</div>
          <label className="field">
            <span>{t("insp_bg_css")}</span>
            <input
              type="text"
              value={card.background}
              onFocus={beginEdit}
              onChange={(e) => onPatchCard({ background: e.target.value })}
            />
          </label>
          <ColorField
            label={t("insp_bg_pick")}
            value={/^#([0-9a-f]{3}){1,2}$/i.test(card.background) ? card.background : "#ffffff"}
            onBegin={beginEdit}
            onChange={(v) => onPatchCard({ background: v })}
          />

          <div className="panel-subtitle">{t("insp_theme")}</div>
          <div className="field-row">
            <ColorField label={t("insp_theme_bg")} value={project.theme.background} onBegin={beginEdit} onChange={(v) => onPatchTheme({ background: v })} />
            <ColorField label={t("insp_theme_text")} value={project.theme.textColor} onBegin={beginEdit} onChange={(v) => onPatchTheme({ textColor: v })} />
            <ColorField label={t("insp_theme_accent")} value={project.theme.accent} onBegin={beginEdit} onChange={(v) => onPatchTheme({ accent: v })} />
          </div>
          <p className="hint">{t("insp_hint")}</p>
        </>
      )}
    </aside>
  );
}

function ColorField({
  label,
  value,
  onBegin,
  onChange,
}: {
  label: string;
  value: string;
  onBegin: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field color-field">
      <span>{label}</span>
      <div className="color-row">
        <input type="color" value={toHex(value)} onFocus={onBegin} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onFocus={onBegin} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}

function toHex(v: string): string {
  return /^#([0-9a-f]{6})$/i.test(v) ? v : /^#([0-9a-f]{3})$/i.test(v) ? v : "#000000";
}
