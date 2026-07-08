"use client";

import { useRef } from "react";
import type { Card, CardElement, Project, Theme } from "@/lib/types";
import { DEFAULT_FONT, DEFAULT_ROLES, SERIF_FONT } from "@/lib/types";
import { newId, roleSharedStyle } from "@/lib/ops";
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
  onReorderElement: (id: string, dir: "back" | "backward" | "forward" | "front") => void;
  onSelectElement: (id: string) => void;
  onAddElement: (el: CardElement) => void;
  onApplyRoleStyle: (role: string, patch: Record<string, unknown>) => void;
  onEnforceRoles: () => void;
}

// A shape/image that spans (nearly) the whole card is acting as a background.
function isFullCover(el: { x: number; y: number; w: number; h: number }): boolean {
  return el.x <= 5 && el.y <= 5 && el.w >= 90 && el.h >= 90;
}

// One-line label for a layer row.
function layerLabel(
  el: CardElement,
  labels: { shape: string; image: string; dim: string; bgImage: string },
): string {
  if (el.type === "shape") return isFullCover(el) ? labels.dim : labels.shape;
  if (el.type === "image") return isFullCover(el) ? labels.bgImage : labels.image;
  return el.text.trim().replace(/\s+/g, " ").slice(0, 22) || labels.shape;
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
  onReorderElement,
  onSelectElement,
  onAddElement,
  onApplyRoleStyle,
  onEnforceRoles,
}: InspectorProps) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const roleLabel = (r: string) =>
    r === "overline" ? t("role_overline")
    : r === "title" ? t("role_title")
    : r === "body" ? t("role_body")
    : r === "caption" ? t("role_caption")
    : r;
  // Roles actually present in this project (defaults first, then custom).
  const roleSet = new Set<string>();
  project.cards.forEach((c) => c.elements.forEach((e) => { if (e.type === "text" && e.role) roleSet.add(e.role); }));
  const isDefault = (r: string) => (DEFAULT_ROLES as readonly string[]).includes(r);
  const customRoles = [...roleSet].filter((r) => !isDefault(r));
  const rolesInProject = [...DEFAULT_ROLES.filter((r) => roleSet.has(r)), ...customRoles];
  const roleOptions = [...DEFAULT_ROLES, ...customRoles];

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

      {card.elements.length > 0 && (
        <div className="layers">
          <div className="panel-subtitle">{t("insp_layers")}</div>
          <div className="layer-list">
            {card.elements
              .slice()
              .reverse()
              .map((el) => (
                <div
                  key={el.id}
                  className={`layer-row ${el.id === element?.id ? "sel" : ""}`}
                  onClick={() => onSelectElement(el.id)}
                >
                  <span className={`layer-ic ${el.type}`}>
                    {el.type === "text" ? "T" : el.type === "shape" ? "▭" : "▧"}
                  </span>
                  <span className="layer-name">
                    {layerLabel(el, {
                      shape: t("sel_shape"),
                      image: t("sel_image"),
                      dim: t("layer_dim"),
                      bgImage: t("layer_bg_image"),
                    })}
                  </span>
                  <span className="layer-ord">
                    <button
                      title={t("lyr_forward")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderElement(el.id, "forward");
                      }}
                    >
                      ↑
                    </button>
                    <button
                      title={t("lyr_backward")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderElement(el.id, "backward");
                      }}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

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
              <label className="field">
                <span>{t("insp_role")}</span>
                <div className="role-row">
                  <select
                    value={element.role ?? ""}
                    onChange={(e) => onPatchElement({ role: e.target.value }, true)}
                  >
                    <option value="">{t("insp_role_none")}</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  {element.role && project.styles?.[element.role] && (
                    <button
                      className="btn small ghost"
                      title={t("insp_role_reset")}
                      onClick={() => onPatchElement({ ...project.styles![element.role!] }, true)}
                    >
                      ↺
                    </button>
                  )}
                </div>
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
            <>
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
              <label className="field">
                <span>
                  {t("insp_dim")} · {Math.round((element.dim ?? 0) * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={element.dim ?? 0}
                  onPointerDown={beginEdit}
                  onChange={(e) => onPatchElement({ dim: Number(e.target.value) })}
                />
              </label>
            </>
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

          <label className="field">
            <span>
              {t("insp_opacity")} · {Math.round((element.opacity ?? 1) * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={element.opacity ?? 1}
              onPointerDown={beginEdit}
              onChange={(e) => onPatchElement({ opacity: Number(e.target.value) })}
            />
          </label>

          <label className="field">
            <span>{t("insp_layer")}</span>
            <div className="segmented layer-btns">
              <button title={t("lyr_back")} onClick={() => onReorderElement(element.id, "back")}>
                {t("lyr_back")}
              </button>
              <button title={t("lyr_backward")} onClick={() => onReorderElement(element.id, "backward")}>
                {t("lyr_backward")}
              </button>
              <button title={t("lyr_forward")} onClick={() => onReorderElement(element.id, "forward")}>
                {t("lyr_forward")}
              </button>
              <button title={t("lyr_front")} onClick={() => onReorderElement(element.id, "front")}>
                {t("lyr_front")}
              </button>
            </div>
          </label>

          <button className="btn danger" onClick={onRemoveElement}>
            {t("insp_delete")}
          </button>
        </>
      ) : (
        <>
          {rolesInProject.length > 0 && (
            <div className="shared-styles">
              <div className="shared-head">
                <span className="panel-subtitle">{t("insp_shared")}</span>
                <button className="btn small ghost" title={t("insp_unify_title")} onClick={onEnforceRoles}>
                  {t("insp_unify")}
                </button>
              </div>
              {rolesInProject.map((r) => {
                const s = roleSharedStyle(project, r);
                return (
                  <div key={r} className="shared-role">
                    <span className="shared-role-name">{roleLabel(r)}</span>
                    <input
                      type="number"
                      className="shared-size"
                      title={t("insp_size")}
                      value={s.fontSize ?? ""}
                      onChange={(e) => onApplyRoleStyle(r, { fontSize: Number(e.target.value) || undefined })}
                    />
                    <select
                      value={s.fontWeight ?? 400}
                      title={t("insp_weight")}
                      onChange={(e) => onApplyRoleStyle(r, { fontWeight: Number(e.target.value) })}
                    >
                      <option value={400}>R</option>
                      <option value={600}>SB</option>
                      <option value={700}>B</option>
                      <option value={800}>EB</option>
                      <option value={900}>Bl</option>
                    </select>
                    <input
                      type="color"
                      title={t("insp_color")}
                      value={toHex(s.color ?? "#ffffff")}
                      onChange={(e) => onApplyRoleStyle(r, { color: e.target.value })}
                    />
                  </div>
                );
              })}
              <p className="hint">{t("insp_shared_hint")}</p>
            </div>
          )}
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
          <div className="theme-colors">
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
