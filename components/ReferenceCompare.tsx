"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";
import { detectReference, fetchReference, PLATFORM_LABEL, type RefPlatform } from "@/lib/reference";
import { shrinkDataUrl, uploadAttachment } from "@/lib/image";
import { useLang } from "@/lib/i18n";

// Side-by-side reference view in the editor: the post this set was made from
// (project.reference, saved at generation) next to the canvas. Follows the
// current card (card k ↔ slide k) until the user browses slides themselves.
// Projects without a reference can attach one here by pasting a link.
export default function ReferenceCompare({
  project,
  cardIdx,
  width,
  height,
  onAttach,
}: {
  project: Project;
  cardIdx: number;
  width: number;
  height: number;
  onAttach: (ref: NonNullable<Project["reference"]>) => void;
}) {
  const { t } = useLang();
  const ref = project.reference;
  const slides = ref?.slides ?? [];
  const [idx, setIdx] = useState(0);
  const [follow, setFollow] = useState(true);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (follow && slides.length) setIdx(Math.min(cardIdx, slides.length - 1));
  }, [cardIdx, follow, slides.length]);

  async function attach() {
    const hit = detectReference(url);
    if (!hit) return setErr(t("wz_ref_bad_url"));
    setLoading(true);
    setErr(null);
    try {
      const post = await fetchReference(hit.url);
      const small = await Promise.all(
        post.slides.map(async (s) => uploadAttachment(await shrinkDataUrl(s, 480).catch(() => s))),
      );
      onAttach({ platform: post.platform, url: post.url, author: post.author, caption: post.caption.slice(0, 2000), slides: small });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("wz_ref_fail"));
    } finally {
      setLoading(false);
    }
  }

  if (!ref || !slides.length) {
    return (
      <div className="refcmp refcmp-empty" style={{ width, height }}>
        <b>{t("ed_ref_none")}</b>
        <p>{t("ed_ref_none_hint")}</p>
        <input
          value={url}
          placeholder="instagram.com/p/… · linkedin.com/posts/… · tiktok.com/…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void attach();
          }}
        />
        <button className="btn ghost" disabled={loading || !url.trim()} onClick={() => void attach()}>
          {loading ? t("wz_ref_loading") : t("wz_ref_load")}
        </button>
        {err && <small className="wz-warn">⚠ {err}</small>}
      </div>
    );
  }

  const go = (d: number) => {
    setFollow(false);
    setIdx((i) => (i + d + slides.length) % slides.length);
  };
  const label = ref.platform in PLATFORM_LABEL ? PLATFORM_LABEL[ref.platform as RefPlatform] : ref.platform;

  return (
    <div className="refcmp" style={{ width }}>
      <div className="refcmp-frame" style={{ width, height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slides[idx]} alt="" />
      </div>
      <div className="refcmp-bar">
        <button onClick={() => go(-1)} aria-label="prev">
          ‹
        </button>
        <span>
          {label}
          {ref.author ? ` @${ref.author}` : ""} · {idx + 1} / {slides.length}
        </span>
        <button onClick={() => go(1)} aria-label="next">
          ›
        </button>
        {!follow && (
          <button className="refcmp-sync" onClick={() => setFollow(true)} title={t("ed_ref_follow")}>
            ⇄
          </button>
        )}
      </div>
    </div>
  );
}
