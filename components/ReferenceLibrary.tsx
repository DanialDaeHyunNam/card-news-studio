"use client";

import { useState } from "react";
import { detectReference, fetchReference, PLATFORM_LABEL, type RefPlatform } from "@/lib/reference";
import { sortLibrary, type RefEntry } from "@/lib/references";
import { useLang } from "@/lib/i18n";

// Home section: every reference post used so far + bookmarked ones.
// ★ = favorite (bookmarks saved ahead of time land here directly).
export default function ReferenceLibrary({
  library,
  onAdd,
  onToggleFavorite,
  onDelete,
  onUse,
}: {
  library: RefEntry[];
  onAdd: (post: Awaited<ReturnType<typeof fetchReference>>) => Promise<void>;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onUse: (entry: RefEntry) => void;
}) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"all" | "fav">("all");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const favCount = library.filter((e) => e.favorite).length;
  const shown = sortLibrary(library).filter((e) => tab === "all" || e.favorite);

  async function save() {
    const hit = detectReference(url);
    if (!hit) return setErr(t("wz_ref_bad_url"));
    setBusy(true);
    setErr(null);
    try {
      await onAdd(await fetchReference(hit.url));
      setUrl("");
      setTab("fav");
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("wz_ref_fail"));
    } finally {
      setBusy(false);
    }
  }

  const date = (ms: number) => new Date(ms).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US");
  const label = (p: string) => (p === "upload" ? t("wz_platform_upload") : (PLATFORM_LABEL[p as RefPlatform] ?? p));

  return (
    <section className="project-grid reflib" id="reference-library">
      <div className="section-head">
        <h2>{t("lib_title")}</h2>
        <div className="wz-tabs reflib-tabs">
          <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
            {t("lib_all")} {library.length}
          </button>
          <button className={tab === "fav" ? "on" : ""} onClick={() => setTab("fav")}>
            ★ {t("lib_fav")} {favCount}
          </button>
        </div>
      </div>
      <p className="reflib-sub">{t("lib_sub")}</p>
      <div className="wz-url reflib-add">
        <input
          value={url}
          placeholder={t("lib_add_ph")}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void save();
          }}
        />
        <button className="btn ghost" disabled={busy || !url.trim()} onClick={() => void save()}>
          {busy ? t("wz_ref_loading") : `★ ${t("lib_add")}`}
        </button>
      </div>
      {err && <small className="wz-warn">⚠ {err}</small>}

      {shown.length === 0 ? (
        <p className="reflib-empty">{t(tab === "fav" ? "lib_empty_fav" : "lib_empty")}</p>
      ) : (
        <div className="reflib-grid">
          {shown.map((e) => (
            <div key={e.id} className="reflib-card">
              <div className="reflib-slides">
                {e.slides.slice(0, 3).map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={s} alt="" />
                ))}
                <button
                  className={`reflib-star ${e.favorite ? "on" : ""}`}
                  title={t("lib_fav")}
                  onClick={() => onToggleFavorite(e.id)}
                >
                  {e.favorite ? "★" : "☆"}
                </button>
              </div>
              <div className="reflib-meta">
                <div className="reflib-line">
                  <span className={`wz-badge ${e.platform}`}>{label(e.platform)}</span>
                  {e.author && <b>@{e.author}</b>}
                  <span className="reflib-count">{e.totalSlides > 1 ? `· ${e.totalSlides}` : ""}</span>
                </div>
                {e.caption && <p className="reflib-caption">{e.caption}</p>}
                <div className="reflib-foot">
                  <span>
                    {e.useCount > 0
                      ? t("lib_used").replace("{n}", String(e.useCount)).replace("{d}", date(e.lastUsedAt ?? e.addedAt))
                      : t("lib_saved").replace("{d}", date(e.addedAt))}
                  </span>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" title={t("lib_open")}>
                      ↗
                    </a>
                  )}
                  <button
                    title="✕"
                    onClick={() => {
                      if (confirm(t("lib_delete_confirm"))) onDelete(e.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <button className="btn ghost reflib-use" onClick={() => onUse(e)}>
                  {t("lib_use")} →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
