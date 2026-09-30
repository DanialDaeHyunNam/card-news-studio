"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Format, GenConfig, Project } from "@/lib/types";
import { FORMATS } from "@/lib/types";
import { MODELS } from "@/lib/models";
import { getTemplates, instantiateTemplate } from "@/lib/templates";
import { fileToGenPhoto, fileToRefImage, IMAGE_ACCEPT, imageFiles } from "@/lib/image";
import {
  detectReference,
  fetchReference,
  PLATFORM_LABEL,
  screenshotReference,
  type ReferencePost,
} from "@/lib/reference";
import {
  stepReady,
  suggestFormat,
  toGenConfig,
  WIZARD_STEPS,
  type RefImage,
  type RefSource,
  type WizardState,
} from "@/lib/wizard";
import { trackEvent } from "@/lib/analytics";
import { detectLang, langLabel, OUTPUT_LANGS, sourceText, type OutputLang } from "@/lib/lang";
import { sortLibrary, type RefEntry } from "@/lib/references";
import { runPlan, slotsNeeded, type Plan } from "@/lib/harness";
import { LAYOUT_SLOTS } from "@/lib/photoset";
import type { UsageEvent } from "@/lib/usage";
import { useLang, type DictKey } from "@/lib/i18n";
import CardView from "./CardView";
import ModelPicker from "./ModelPicker";
import SegmentPicker from "./SegmentPicker";

const MAX_PHOTOS = 20;
const MAX_REF_IMAGES = 10;
const SCRIPT_LIMIT = 16000; // chars the prompt keeps (lib/requests.ts)
const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;
const LONG_SECONDS = 20 * 60; // longer videos: ask which segment fills the script
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

interface YtResult {
  videoId: string;
  title: string;
  duration: number;
  lines: { t: number; text: string }[];
}

interface Props {
  onOpenTemplate: (templateId: string) => void; // open a template in the editor as-is (manual editing)
  library: RefEntry[]; // reference library — quick picks in step 1
  onReferenceLoaded: (post: ReferencePost) => void; // record a freshly loaded post in the library
  onLibraryUse: (entry: RefEntry) => void | Promise<void>;
  wizard: WizardState;
  setWizard: (fn: (w: WizardState) => WizardState) => void;
  projects: Project[];
  keys: Record<string, boolean> | null;
  onConnectKey: () => void;
  accent: string | null;
  setAccent: (v: string | null) => void;
  busy?: boolean;
  error?: string | null;
  onGenerate: (cfg: GenConfig) => void;
}

interface Analysis {
  status: "running" | "ask" | "done" | "error";
  reply: string; // the model's analysis text (streams in)
  plan: Plan | null;
  dialogue: { question: string; answer: string }[];
  usages: UsageEvent[];
  error: string | null;
}

const STEP_LABELS: DictKey[] = ["wz_s1", "wz_s2", "wz_s3", "wz_s4", "wz_s5"];

export default function CreateWizard(props: Props) {
  const { wizard: w, setWizard, projects, keys, onConnectKey, accent, setAccent, busy, error, onGenerate } = props;
  const { lang, t } = useLang();
  const patch = (p: Partial<WizardState>) => setWizard((cur) => ({ ...cur, ...p }));
  const go = (step: number) => setWizard((cur) => ({ ...cur, step, maxStep: Math.max(cur.maxStep, step) }));

  const templates = useMemo(
    () =>
      getTemplates(lang).map((tpl) => {
        const project = instantiateTemplate(tpl);
        return { tpl, firstCard: project.cards[0], theme: project.theme };
      }),
    [lang],
  );
  const selectedTpl = templates.find((x) => x.tpl.id === w.templateId)?.tpl ?? null;

  // The ratio the reference implies (shown as "recommended"); applied
  // automatically until the user picks a ratio themselves.
  const [suggested, setSuggested] = useState<Format | null>(null);
  useEffect(() => {
    let alive = true;
    const apply = (f: Format | null) => {
      if (!alive) return;
      setSuggested(f);
      if (f) setWizard((cur) => (cur.formatTouched ? cur : { ...cur, format: f }));
    };
    if (w.refSource === "url" && w.refPost) void suggestFormat(w.refPost).then(apply);
    else if (w.refSource === "template" && selectedTpl) apply(selectedTpl.format);
    else apply(null);
    return () => {
      alive = false;
    };
  }, [w.refSource, w.refPost, selectedTpl, setWizard]);

  // Analyze → (ask ↔ answer)* → generate. Runs when there are photos to place
  // or a reference with slides to read; otherwise straight to generation.
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const cfgExtras = () => ({
    accent: accent ?? undefined,
    templateRef: selectedTpl ? { name: selectedTpl.name, theme: selectedTpl.theme, cards: selectedTpl.cards } : undefined,
  });

  async function analyze(dialogue: Analysis["dialogue"], usages: UsageEvent[]) {
    setAnalysis({ status: "running", reply: "", plan: null, dialogue, usages, error: null });
    const video = w.goal === "video";
    try {
      const { plan, usage } = await runPlan(
        {
          format: w.format,
          mode: w.goal ?? "story",
          topic: video ? w.extra : w.story,
          script: video ? w.script : undefined,
          designNotes: w.designNotes,
          cardCount: w.cardCount,
          photos: w.photos.map((p) => p.api),
          referencePost: w.refSource === "url" ? (w.refPost ?? undefined) : undefined,
          dialogue,
          outputLang: w.outputLang,
          intent: w.intent,
          lang,
          model: w.model,
        },
        (reply) => setAnalysis((a) => (a ? { ...a, reply } : a)),
      );
      const allUsages = usage ? [...usages, usage] : usages;
      if (plan.sufficient && plan.cards.length) {
        setAnalysis({ status: "done", reply: plan.reply, plan, dialogue, usages: allUsages, error: null });
        onGenerate({
          ...toGenConfig(w, cfgExtras()),
          plan: plan.cards,
          refStyle: plan.style ?? undefined,
          planUsage: allUsages,
        });
      } else {
        setAnalysis({ status: "ask", reply: plan.reply, plan, dialogue, usages: allUsages, error: null });
      }
    } catch (e) {
      setAnalysis((a) => ({
        status: "error",
        reply: a?.reply ?? "",
        plan: a?.plan ?? null,
        dialogue,
        usages,
        error: e instanceof Error ? e.message : t("wz_an_fail"),
      }));
    }
  }

  function submit() {
    const selected = MODELS.find((m) => m.id === w.model);
    if (selected && keys && !keys[selected.envVar]) return onConnectKey();
    const needsPlan = w.photos.length > 0 || (w.refSource === "url" && (w.refPost?.slides.length ?? 0) > 0);
    if (needsPlan) {
      trackEvent("generate_click", { model: w.model, format: w.format, goal: w.goal ?? "", analyze: true });
      void analyze([], []);
      return;
    }
    trackEvent("generate_click", {
      model: w.model,
      format: w.format,
      goal: w.goal ?? "",
      ref: w.refSource === "url" ? (w.refPost?.platform ?? "none") : w.refSource,
      photos: w.photos.length,
      auto: w.cardCount === 0,
    });
    onGenerate(toGenConfig(w, cfgExtras()));
  }

  const ready = stepReady(w, w.step);
  const last = w.step === WIZARD_STEPS - 1;

  return (
    <div className="wizard">
      <ol className="wz-steps">
        {STEP_LABELS.map((key, i) => (
          <li key={key}>
            <button
              className={`wz-step ${i === w.step ? "on" : ""} ${i < w.step || i <= w.maxStep ? "reached" : ""}`}
              disabled={i > w.maxStep}
              onClick={() => go(i)}
            >
              <span className="wz-num">{i < w.step ? "✓" : i + 1}</span>
              <span className="wz-text">
                <span className="wz-label">{t(key)}</span>
                <span className="wz-sum">{summary(i, w, t, selectedTpl?.name, projects)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {analysis ? (
        <AnalyzePanel
          analysis={analysis}
          w={w}
          patch={patch}
          busy={busy}
          onAnswer={(answer) => {
            const q = analysis.plan?.question || t("wz_an_q_default");
            void analyze([...analysis.dialogue, { question: q, answer }], analysis.usages);
          }}
          onRetry={() => void analyze(analysis.dialogue, analysis.usages)}
          onCancel={() => setAnalysis(null)}
        />
      ) : (
      <div className="wz-body">
        {w.step === 0 && <ReferenceStep {...props} patch={patch} templates={templates} />}
        {w.step === 1 && <GoalStep w={w} patch={patch} />}
        {w.step === 2 && <DesignStep w={w} patch={patch} accent={accent} setAccent={setAccent} />}
        {w.step === 3 && <RatioStep w={w} patch={patch} suggested={suggested} />}
        {w.step === 4 && (
          <ModelStep w={w} patch={patch} keys={keys} onConnectKey={onConnectKey} selectedTpl={selectedTpl?.name} />
        )}
      </div>

      )}

      {error && <div className="hero-error wz-error">{error}</div>}

      {!analysis && (
      <div className="wz-nav">
        <button className="btn ghost" disabled={w.step === 0 || busy} onClick={() => go(w.step - 1)}>
          ← {t("wz_back")}
        </button>
        {!ready && <span className="wz-need">{t(w.step === 1 ? "wz_need_goal" : "wz_need_model")}</span>}
        {last ? (
          <button className="btn pill-white wz-go" disabled={!ready || busy} onClick={submit}>
            {busy ? t("gen_busy") : `✨ ${t("wz_generate")}`}
          </button>
        ) : (
          <button className="btn pill-white" disabled={!ready} onClick={() => go(w.step + 1)}>
            {w.step === 0 && w.refSource === "none" ? t("wz_skip") : t("wz_next")} →
          </button>
        )}
      </div>
      )}
    </div>
  );
}

// "upload" (screenshots) is the only platform name that needs translating.
function platformName(p: ReferencePost["platform"], t: (k: DictKey) => string): string {
  return p === "upload" ? t("wz_platform_upload") : PLATFORM_LABEL[p];
}

// One-line recap under each step in the stepper.
function summary(
  i: number,
  w: WizardState,
  t: (k: DictKey) => string,
  tplName: string | undefined,
  projects: Project[],
): string {
  if (i === w.step || i > w.maxStep) return ""; // recap only steps already answered
  switch (i) {
    case 0:
      if (w.refSource === "url") return w.refPost ? platformName(w.refPost.platform, t) : t("wz_none");
      if (w.refSource === "template") return tplName ?? t("wz_none");
      if (w.refSource === "project") return projects.find((p) => p.id === w.projectRefId)?.name.slice(0, 12) ?? t("wz_none");
      return t("wz_none");
    case 1:
      return w.goal === "video" ? t("wz_goal_video_short") : w.goal === "story" ? t("wz_goal_story_short") : "";
    case 2:
      return `${w.cardCount ? `${w.cardCount}${t("cards_unit")}` : t("cards_auto")}${w.photos.length ? ` · 📷${w.photos.length}` : ""}`;
    case 3:
      return w.format;
    case 4: {
      const m = MODELS.find((x) => x.id === w.model);
      return m?.short ?? "";
    }
  }
  return "";
}

// ------------------------------------------------------------- 1. reference

function ReferenceStep({
  wizard: w,
  patch,
  projects,
  templates,
  onOpenTemplate,
  library,
  onReferenceLoaded,
  onLibraryUse,
}: Props & {
  patch: (p: Partial<WizardState>) => void;
  templates: { tpl: { id: string; name: string; format: Format }; firstCard: Project["cards"][number]; theme: Project["theme"] }[];
}) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const shotInput = useRef<HTMLInputElement>(null);

  async function load(raw: string) {
    const hit = detectReference(raw);
    patch({ refUrl: raw });
    if (!hit) {
      setFetchErr(raw.trim() ? t("wz_ref_bad_url") : null);
      return;
    }
    setLoading(true);
    setFetchErr(null);
    try {
      const post = await fetchReference(hit.url);
      patch({ refPost: post });
      onReferenceLoaded(post);
    } catch (e) {
      patch({ refPost: null });
      setFetchErr(e instanceof Error ? e.message : t("wz_ref_fail"));
    } finally {
      setLoading(false);
    }
  }

  // Scrape failed (or the user prefers it): screenshots of the post become the reference.
  async function addShots(list: FileList | File[] | null) {
    const files = imageFiles(list).slice(0, 10);
    if (!files.length) return;
    const imgs = await Promise.all(files.map((f) => fileToRefImage(f).catch(() => null)));
    const slides = imgs.filter((x): x is RefImage => !!x).map((x) => x.api);
    const prev = w.refPost?.platform === "upload" ? w.refPost.slides : [];
    patch({ refPost: screenshotReference([...prev, ...slides].slice(0, 10), w.refUrl.trim()) });
    setFetchErr(null);
  }

  const tabs: { id: RefSource; label: DictKey }[] = [
    { id: "url", label: "wz_ref_tab_url" },
    { id: "template", label: "wz_ref_tab_tpl" },
    ...(projects.length ? [{ id: "project" as RefSource, label: "wz_ref_tab_proj" as DictKey }] : []),
    { id: "none", label: "wz_ref_tab_none" },
  ];

  return (
    <div className="wz-panel">
      <h3>{t("wz_ref_q")}</h3>
      <p className="wz-hint">{t("wz_ref_hint")}</p>
      <div className="wz-tabs">
        {tabs.map((tb) => (
          <button key={tb.id} className={w.refSource === tb.id ? "on" : ""} onClick={() => patch({ refSource: tb.id })}>
            {t(tb.label)}
            {tb.id === "url" && <em className="wz-tab-rec">{t("wz_rec")}</em>}
          </button>
        ))}
      </div>

      {w.refSource === "url" && (
        <>
          <div className="wz-url">
            <input
              value={w.refUrl}
              placeholder="https://www.instagram.com/p/…  ·  linkedin.com/posts/…  ·  tiktok.com/@…/video/…"
              onChange={(e) => patch({ refUrl: e.target.value })}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (detectReference(text)) {
                  e.preventDefault();
                  void load(text.trim());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void load(w.refUrl);
              }}
            />
            <button className="btn ghost" disabled={loading || !w.refUrl.trim()} onClick={() => void load(w.refUrl)}>
              {loading ? t("wz_ref_loading") : t("wz_ref_load")}
            </button>
          </div>

          {fetchErr && (
            <div className="wz-fallback">
              <b>⚠ {fetchErr}</b>
              <span>{t("wz_ref_fallback")}</span>
              <button className="btn ghost" onClick={() => shotInput.current?.click()}>
                📸 {t("wz_ref_shots")}
              </button>
            </div>
          )}
          {w.refPost && <ReferencePreview post={w.refPost} onClear={() => patch({ refPost: null, refUrl: "" })} />}
          {!w.refPost && library.length > 0 && (
            <LibraryStrip library={library} onPick={onLibraryUse} />
          )}
          {w.refPost?.partial && <p className="wz-hint">{t("wz_ref_partial")}</p>}
          {!fetchErr && (
            <button className="link-mini wz-manual" onClick={() => shotInput.current?.click()}>
              {w.refPost?.platform === "upload" ? `+ ${t("wz_ref_more_shots")}` : t("wz_ref_manual")}
            </button>
          )}
          <input
            ref={shotInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addShots(files);
            }}
          />
        </>
      )}

      {w.refSource === "template" && (
        <>
        <div className="wz-grid">
          {templates.map(({ tpl, firstCard, theme }) => (
            <button
              key={tpl.id}
              className={`wz-tile ${w.templateId === tpl.id ? "on" : ""}`}
              onClick={() => patch({ templateId: tpl.id })}
            >
              <span className="wz-tile-thumb">
                <CardView card={firstCard} theme={theme} format={tpl.format} width={84} />
              </span>
              <span className="wz-tile-name">{tpl.name}</span>
            </button>
          ))}
        </div>
        {w.templateId && (
          <button className="link-mini wz-manual" onClick={() => onOpenTemplate(w.templateId!)}>
            {t("wz_open_tpl")} →
          </button>
        )}
        </>
      )}

      {w.refSource === "project" && (
        <div className="wz-grid">
          {projects
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => (
              <button
                key={p.id}
                className={`wz-tile ${w.projectRefId === p.id ? "on" : ""}`}
                onClick={() => patch({ projectRefId: p.id })}
              >
                <span className="wz-tile-thumb">
                  <CardView card={p.cards[0]} theme={p.theme} format={p.format} width={84} />
                </span>
                <span className="wz-tile-name">{p.name}</span>
              </button>
            ))}
        </div>
      )}

      {w.refSource === "none" && <p className="wz-hint">{t("wz_ref_none_hint")}</p>}
    </div>
  );
}

function ReferencePreview({ post, onClear }: { post: ReferencePost; onClear: () => void }) {
  const { t } = useLang();
  const fmt = (n?: number) => (n === undefined ? null : n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString());
  const stats = [
    ["▶", fmt(post.stats.plays)],
    ["♥", fmt(post.stats.likes)],
    ["💬", fmt(post.stats.comments)],
    ["↗", fmt(post.stats.shares)],
    ["🔖", fmt(post.stats.saves)],
  ].filter((s): s is [string, string] => !!s[1]);
  return (
    <div className="wz-ref">
      <div className="wz-ref-head">
        <span className={`wz-badge ${post.platform}`}>{platformName(post.platform, t)}</span>
        {post.author && <b>@{post.author}</b>}
        <span className="wz-ref-kind">
          {t(`wz_kind_${post.kind}` as DictKey)}
          {post.totalSlides > 1 ? ` · ${post.totalSlides}` : ""}
        </span>
        <button className="link-mini" onClick={onClear}>
          ✕
        </button>
      </div>
      {stats.length > 0 && (
        <div className="wz-ref-stats">
          {stats.map(([icon, v]) => (
            <span key={icon}>
              {icon} {v}
            </span>
          ))}
        </div>
      )}
      {post.caption && <p className="wz-ref-caption">{post.caption}</p>}
      <div className="wz-ref-slides">
        {post.slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={s} alt="" />
        ))}
      </div>
      {(post.transcript || post.slideTexts?.length) && (
        <p className="wz-hint">✓ {t(post.transcript ? "wz_ref_has_subs" : "wz_ref_has_texts")}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 2. goal

function GoalStep({ w, patch }: { w: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const { t } = useLang();
  const [fetching, setFetching] = useState(false);
  const [subErr, setSubErr] = useState<string | null>(null);
  const [ytLong, setYtLong] = useState<YtResult | null>(null);
  const [showMore, setShowMore] = useState(!!(w.notes || w.refImages.length));
  const refImgInput = useRef<HTMLInputElement>(null);

  const fillScript = (text: string, extra: Partial<WizardState> = {}) =>
    patch({ script: w.script.trim() ? `${w.script.trim()}\n\n${text}` : text, ...extra });

  // Video link → subtitles into the script box: YouTube captions (InnerTube),
  // TikTok subtitles or captions via /api/reference. Failure = paste manually.
  async function fetchSubs() {
    const url = w.videoUrl.trim();
    if (!url) return;
    setFetching(true);
    setSubErr(null);
    try {
      if (YT_RE.test(url)) {
        const res = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const yt = (await res.json()) as YtResult & { error?: string };
        if (!res.ok) throw new Error(yt.error || t("wz_subs_fail"));
        if ((yt.duration || 0) >= LONG_SECONDS) setYtLong(yt);
        else applyYt(yt, 0, Number.MAX_SAFE_INTEGER);
      } else if (detectReference(url)) {
        const post = await fetchReference(url);
        const text = post.transcript || post.caption;
        if (!text) throw new Error(t("wz_subs_fail"));
        fillScript(text, { videoTitle: post.caption.split("\n")[0].slice(0, 40), youtubeId: null });
        if (!post.transcript) setSubErr(t("wz_subs_caption_only"));
      } else {
        throw new Error(t("wz_subs_bad_url"));
      }
    } catch (e) {
      setSubErr(e instanceof Error ? e.message : t("wz_subs_fail"));
    } finally {
      setFetching(false);
    }
  }

  function applyYt(yt: YtResult, start: number, end: number) {
    setYtLong(null);
    let lines = yt.lines.filter((l) => l.t >= start && l.t < end);
    if (!lines.length) lines = yt.lines;
    fillScript(lines.map((l) => `[${mmss(l.t)}] ${l.text}`).join("\n"), { videoTitle: yt.title, youtubeId: yt.videoId });
  }

  async function addRefImages(list: FileList | File[] | null) {
    const files = imageFiles(list).slice(0, MAX_REF_IMAGES - w.refImages.length);
    const added = (await Promise.all(files.map((f) => fileToRefImage(f).catch(() => null)))).filter(
      (x): x is RefImage => !!x,
    );
    if (added.length) patch({ refImages: [...w.refImages, ...added].slice(0, MAX_REF_IMAGES) });
  }

  return (
    <div className="wz-panel">
      <h3>{t("wz_goal_q")}</h3>
      <div className="wz-choices">
        <button className={`wz-choice ${w.goal === "video" ? "on" : ""}`} onClick={() => patch({ goal: "video" })}>
          <span className="wz-choice-icon">🎬</span>
          <b>{t("wz_goal_video")}</b>
          <small>{t("wz_goal_video_sub")}</small>
        </button>
        <button className={`wz-choice ${w.goal === "story" ? "on" : ""}`} onClick={() => patch({ goal: "story" })}>
          <span className="wz-choice-icon">📝</span>
          <b>{t("wz_goal_story")}</b>
          <small>{t("wz_goal_story_sub")}</small>
        </button>
      </div>

      {w.goal === "video" && (
        <>
          <label className="wz-field">
            <span>{t("wz_video_url")}</span>
            <div className="wz-url">
              <input
                value={w.videoUrl}
                placeholder="YouTube · TikTok · Instagram Reels"
                onChange={(e) => patch({ videoUrl: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) void fetchSubs();
                }}
              />
              <button className="btn ghost" disabled={fetching || !w.videoUrl.trim()} onClick={() => void fetchSubs()}>
                {fetching ? t("wz_ref_loading") : t("wz_subs_fetch")}
              </button>
            </div>
            {subErr && <small className="wz-warn">⚠ {subErr}</small>}
          </label>
          <label className="wz-field">
            <span>
              {t("wz_script")} <em className="wz-count">{w.script.length.toLocaleString()}</em>
            </span>
            <textarea
              rows={8}
              value={w.script}
              placeholder={t("wz_script_ph")}
              onChange={(e) => patch({ script: e.target.value })}
            />
            {w.script.length > SCRIPT_LIMIT && <small className="wz-warn">⚠ {t("wz_script_long")}</small>}
          </label>
          <label className="wz-field">
            <span>{t("wz_extra")}</span>
            <textarea rows={3} value={w.extra} placeholder={t("wz_extra_ph")} onChange={(e) => patch({ extra: e.target.value })} />
          </label>
        </>
      )}

      {w.goal === "story" && (
        <label className="wz-field">
          <span>{t("wz_story")}</span>
          <textarea
            rows={9}
            value={w.story}
            placeholder={t("wz_story_ph")}
            onChange={(e) => patch({ story: e.target.value })}
          />
        </label>
      )}

      {w.goal && (
        <label className="wz-field">
          <span>{t("wz_intent")}</span>
          <textarea
            rows={2}
            value={w.intent}
            placeholder={t("wz_intent_ph")}
            onChange={(e) => patch({ intent: e.target.value })}
          />
          <small className="wz-hint">{t("wz_intent_hint")}</small>
        </label>
      )}

      {w.goal && <OutputLangField w={w} patch={patch} />}

      {w.goal && (
        <div className="wz-more">
          {!showMore ? (
            <button className="link-mini" onClick={() => setShowMore(true)}>
              + {t("wz_more")}
            </button>
          ) : (
            <label className="wz-field">
              <span>{t("wz_more")}</span>
              <textarea
                rows={3}
                value={w.notes}
                placeholder={t("wz_notes_ph")}
                onChange={(e) => patch({ notes: e.target.value })}
                onPaste={(e) => {
                  const files = imageFiles(e.clipboardData.files);
                  if (files.length) {
                    e.preventDefault();
                    void addRefImages(files);
                  }
                }}
              />
              <div className="ref-images">
                {w.refImages.map((r) => (
                  <div key={r.id} className="photo-thumb small">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumb} alt="" />
                    <button
                      className="photo-x"
                      onClick={() => patch({ refImages: w.refImages.filter((x) => x.id !== r.id) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {w.refImages.length < MAX_REF_IMAGES && (
                  <button className="photo-add small" onClick={() => refImgInput.current?.click()}>
                    + {t("ref_add_images")}
                  </button>
                )}
              </div>
              <input
                ref={refImgInput}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  void addRefImages(files);
                }}
              />
            </label>
          )}
        </div>
      )}

      {ytLong && (
        <SegmentPicker
          title={ytLong.title}
          durationSec={ytLong.duration}
          onConfirm={(s, e) => applyYt(ytLong, s, e)}
          onClose={() => setYtLong(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 3. design

function DesignStep({
  w,
  patch,
  accent,
  setAccent,
}: {
  w: WizardState;
  patch: (p: Partial<WizardState>) => void;
  accent: string | null;
  setAccent: (v: string | null) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function addPhotos(list: FileList | File[] | null) {
    const files = imageFiles(list).slice(0, MAX_PHOTOS - w.photos.length);
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    const errors: string[] = [];
    const added = [];
    for (const f of files) {
      try {
        added.push(await fileToGenPhoto(f));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : f.name);
      }
    }
    setBusy(false);
    if (errors.length) setErr(errors.join(" · "));
    if (added.length) patch({ photos: [...w.photos, ...added].slice(0, MAX_PHOTOS) });
  }

  function movePhoto(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= w.photos.length) return;
    const next = w.photos.slice();
    [next[from], next[to]] = [next[to], next[from]];
    patch({ photos: next });
  }

  return (
    <div className="wz-panel">
      <h3>{t("wz_design_q")}</h3>
      <label className="wz-field">
        <span>{t("wz_count")}</span>
        <div className="wz-chips">
          {[0, 4, 6, 8, 10, 12].map((n) => (
            <button key={n} className={w.cardCount === n ? "on" : ""} onClick={() => patch({ cardCount: n })}>
              {n === 0 ? `✨ ${t("cards_auto")}` : `${n}${t("cards_unit")}`}
            </button>
          ))}
        </div>
      </label>
      <label className="wz-field">
        <span>{t("wz_design_notes")}</span>
        <textarea
          rows={3}
          value={w.designNotes}
          placeholder={t("wz_design_ph")}
          onChange={(e) => patch({ designNotes: e.target.value })}
        />
      </label>

      <div
        className={`wz-field wz-photos ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void addPhotos(e.dataTransfer.files);
        }}
      >
        <span>
          {t("wz_photos")} {w.photos.length > 0 && <em className="wz-count">{w.photos.length}</em>}
        </span>
        <small className="wz-hint">{t("wz_photos_hint")}</small>
        <div className="photo-tray-row">
          {w.photos.map((p, i) => (
            <div key={p.id} className="photo-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" />
              <span className="photo-num">{i + 1}</span>
              <button className="photo-x" onClick={() => patch({ photos: w.photos.filter((x) => x.id !== p.id) })}>
                ✕
              </button>
              <div className="photo-move">
                <button disabled={i === 0} onClick={() => movePhoto(i, -1)}>
                  ‹
                </button>
                <button disabled={i === w.photos.length - 1} onClick={() => movePhoto(i, 1)}>
                  ›
                </button>
              </div>
            </div>
          ))}
          {w.photos.length < MAX_PHOTOS && (
            <button className="photo-add" disabled={busy} onClick={() => photoInput.current?.click()}>
              {busy ? "…" : "+"}
            </button>
          )}
        </div>
        {err && <small className="wz-warn">⚠ {err}</small>}
        <input
          ref={photoInput}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void addPhotos(files);
          }}
        />
      </div>

      <div className="wz-field">
        <span>{t("wz_brand")}</span>
        <small className="wz-hint">{t("wz_brand_hint")}</small>
        <div className="wz-chips wz-brand">
          <button className={accent === null ? "on" : ""} onClick={() => setAccent(null)}>
            ✨ {t("accent_auto")}
          </button>
          <label className={`wz-brand-custom ${accent && accent !== "none" ? "on" : ""}`}>
            <span
              className="wz-brand-swatch"
              style={{ background: accent && accent !== "none" ? accent : "#3b82f6" }}
            />
            {t("wz_brand_custom")}
            <input
              type="color"
              value={accent && accent !== "none" ? accent : "#3b82f6"}
              onChange={(e) => setAccent(e.target.value)}
              onClick={() => {
                if (!accent || accent === "none") setAccent("#3b82f6");
              }}
            />
          </label>
          <button className={accent === "none" ? "on" : ""} onClick={() => setAccent("none")}>
            ⦸ {t("wz_brand_none")}
          </button>
        </div>
        <small className="wz-hint wz-brand-mode">
          {t(accent === null ? "wz_brand_auto_desc" : accent === "none" ? "wz_brand_none_desc" : "wz_brand_custom_desc")}
        </small>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- 4. ratio

function RatioStep({
  w,
  patch,
  suggested,
}: {
  w: WizardState;
  patch: (p: Partial<WizardState>) => void;
  suggested: Format | null;
}) {
  const { t } = useLang();
  const hints: Record<Format, DictKey> = { "1:1": "fmt_11", "4:5": "fmt_45", "9:16": "fmt_916" };
  return (
    <div className="wz-panel">
      <h3>{t("wz_ratio_q")}</h3>
      <div className="wz-ratios">
        {(Object.keys(FORMATS) as Format[]).map((f) => (
          <button
            key={f}
            className={`wz-ratio ${w.format === f ? "on" : ""}`}
            onClick={() => patch({ format: f, formatTouched: true })}
          >
            <span className="wz-frame" style={{ aspectRatio: `${FORMATS[f].w} / ${FORMATS[f].h}` }} />
            <b>{f}</b>
            <small>{t(hints[f])}</small>
            {suggested === f && <em className="wz-rec">{t("wz_ratio_rec")}</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- 5. model

function ModelStep({
  w,
  patch,
  keys,
  onConnectKey,
  selectedTpl,
}: {
  w: WizardState;
  patch: (p: Partial<WizardState>) => void;
  keys: Record<string, boolean> | null;
  onConnectKey: () => void;
  selectedTpl?: string;
}) {
  const { t } = useLang();
  const model = MODELS.find((m) => m.id === w.model);
  const cli = model?.provider === "claude-cli";
  return (
    <div className="wz-panel">
      <h3>{t("wz_model_q")}</h3>
      <div className="wz-model">
        <ModelPicker
          value={w.model}
          onChange={(id) => patch({ model: id })}
          keys={keys}
          onConnectKey={onConnectKey}
          placement="up"
        />
        <p className="wz-hint">{t(cli ? "wz_model_cli" : "wz_model_key")}</p>
      </div>
      <ul className="wz-recap">
        <li>
          <span>{t("wz_s1")}</span>
          <b>
            {w.refSource === "url" && w.refPost
              ? `${platformName(w.refPost.platform, t)}${w.refPost.author ? ` @${w.refPost.author}` : ""}`
              : w.refSource === "template" && selectedTpl
                ? selectedTpl
                : t("wz_none")}
          </b>
        </li>
        <li>
          <span>{t("wz_s2")}</span>
          <b>
            {w.goal === "video" ? t("wz_goal_video_short") : t("wz_goal_story_short")} ·{" "}
            {w.outputLang === "auto" ? t("wz_lang_auto") : langLabel(w.outputLang)}
          </b>
        </li>
        <li>
          <span>{t("wz_s3")}</span>
          <b>
            {w.cardCount ? `${w.cardCount}${t("cards_unit")}` : t("cards_auto")}
            {w.photos.length ? ` · 📷 ${w.photos.length}` : ""}
            {w.designNotes.trim() ? ` · ${w.designNotes.trim().slice(0, 24)}` : ""}
          </b>
        </li>
        <li>
          <span>{t("wz_s4")}</span>
          <b>{w.format}</b>
        </li>
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- analyze / ask

function AnalyzePanel({
  analysis: a,
  w,
  patch,
  busy,
  onAnswer,
  onRetry,
  onCancel,
}: {
  analysis: Analysis;
  w: WizardState;
  patch: (p: Partial<WizardState>) => void;
  busy?: boolean;
  onAnswer: (answer: string) => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const [added, setAdded] = useState(0); // photos uploaded since the question
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const plan = a.plan;
  const need = plan ? slotsNeeded(plan) : 0;
  const running = a.status === "running" || a.status === "done";

  async function addPhotos(list: FileList | File[] | null) {
    const files = imageFiles(list).slice(0, MAX_PHOTOS - w.photos.length);
    if (!files.length) return;
    setUploading(true);
    const addedPhotos = (await Promise.all(files.map((f) => fileToGenPhoto(f).catch(() => null)))).filter(
      (p): p is NonNullable<typeof p> => !!p,
    );
    setUploading(false);
    if (addedPhotos.length) {
      patch({ photos: [...w.photos, ...addedPhotos].slice(0, MAX_PHOTOS) });
      setAdded((n) => n + addedPhotos.length);
    }
  }

  return (
    <div className="wz-body wz-analyze">
      <div className="wz-an-head">
        {running ? <span className="btn-spinner dark" /> : <span className="wz-an-dot" />}
        <b>
          {a.status === "done"
            ? t("wz_an_done")
            : a.status === "ask"
              ? t("wz_an_ask_title")
              : a.status === "error"
                ? t("wz_an_fail")
                : t("wz_an_running")}
        </b>
      </div>
      {a.reply && <p className="wz-an-reply">{a.reply}</p>}

      {plan && plan.cards.length > 0 && (
        <>
          <div className="wz-an-meta">
            {plan.cards.length}
            {t("cards_unit")} · {t("wz_an_cuts").replace("{need}", String(need)).replace("{have}", String(w.photos.length))}
            {plan.referenceLayout ? ` · ${plan.referenceLayout}` : ""}
          </div>
          <div className="wz-an-cards">
            {plan.cards.map((c, i) => (
              <div
                key={i}
                className="wz-an-card"
                style={{ aspectRatio: `${FORMATS[w.format].w} / ${FORMATS[w.format].h}` }}
                title={c.idea}
              >
                {LAYOUT_SLOTS[c.layout].map((r, j) => {
                  const photo = w.photos[(c.photos[j] ?? 0) - 1];
                  return (
                    <span
                      key={j}
                      className={`wz-an-slot ${photo ? "" : "empty"}`}
                      style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photo ? <img src={photo.thumb} alt="" /> : "?"}
                    </span>
                  );
                })}
                <em>{i + 1}</em>
              </div>
            ))}
          </div>
        </>
      )}

      {a.status === "ask" && plan && (
        <div className="wz-ask">
          {plan.question && <p className="wz-ask-q">{plan.question}</p>}
          <div className="wz-ask-opts">
            {plan.options.map((o) => (
              <button key={o} className="btn ghost" disabled={busy} onClick={() => onAnswer(o)}>
                {o}
              </button>
            ))}
          </div>
          <div className="wz-ask-row">
            <button className="btn ghost" disabled={uploading} onClick={() => photoInput.current?.click()}>
              {uploading ? "…" : `📷 ${t("wz_an_add_photos")}`}
            </button>
            {added > 0 && (
              <button
                className="btn pill-white"
                onClick={() => {
                  setAdded(0);
                  onAnswer(t("wz_an_added").replace("{n}", String(added)));
                }}
              >
                {t("wz_an_reanalyze").replace("{n}", String(added))}
              </button>
            )}
          </div>
          <div className="wz-url">
            <input
              value={text}
              placeholder={t("wz_an_answer_ph")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) {
                  onAnswer(text.trim());
                  setText("");
                }
              }}
            />
            <button
              className="btn ghost"
              disabled={!text.trim()}
              onClick={() => {
                onAnswer(text.trim());
                setText("");
              }}
            >
              {t("wz_an_send")}
            </button>
          </div>
          <input
            ref={photoInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void addPhotos(files);
            }}
          />
        </div>
      )}

      {a.status === "error" && (
        <div className="wz-fallback">
          <b>⚠ {a.error}</b>
          <button className="btn ghost" onClick={onRetry}>
            {t("wz_an_retry")}
          </button>
        </div>
      )}

      <div className="wz-nav wz-an-nav">
        <button className="btn ghost" disabled={a.status === "done" && busy} onClick={onCancel}>
          ← {t("wz_an_back")}
        </button>
      </div>
    </div>
  );
}

// Step-1 quick picks from the reference library: favorites first, then recent.
function LibraryStrip({ library, onPick }: { library: RefEntry[]; onPick: (e: RefEntry) => void | Promise<void> }) {
  const { t } = useLang();
  const [picking, setPicking] = useState<string | null>(null);
  const items = sortLibrary(library).slice(0, 12);
  return (
    <div className="wz-lib">
      <div className="wz-lib-head">
        <span>{t("lib_strip")}</span>
        <a href="#reference-library">{t("lib_manage")} ↓</a>
      </div>
      <div className="wz-lib-row">
        {items.map((e) => (
          <button
            key={e.id}
            className="wz-lib-item"
            disabled={!!picking}
            title={e.caption.slice(0, 120)}
            onClick={async () => {
              setPicking(e.id);
              try {
                await onPick(e);
              } finally {
                setPicking(null);
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {e.slides[0] ? <img src={e.slides[0]} alt="" /> : <span className="wz-lib-blank" />}
            {e.favorite && <em className="wz-lib-star">★</em>}
            <span className="wz-lib-name">{picking === e.id ? "…" : e.author ? `@${e.author}` : t("wz_platform_upload")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Copy language — "auto" follows the subtitles/script/story (live-detected).
function OutputLangField({ w, patch }: { w: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const { t } = useLang();
  const src = sourceText(w.goal === "video" ? [w.script, w.extra] : [w.story]);
  const d = detectLang(src);
  const autoLabel = d === "latin" ? t("wz_lang_auto_same") : d ? langLabel(d) : t("wz_lang_auto_ui");
  return (
    <label className="wz-field wz-lang">
      <span>{t("wz_lang")}</span>
      <select
        className="ctl"
        value={w.outputLang}
        onChange={(e) => patch({ outputLang: e.target.value as OutputLang })}
      >
        <option value="auto">
          {t("wz_lang_auto")} — {autoLabel}
        </option>
        {OUTPUT_LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      <small className="wz-hint">{t("wz_lang_hint")}</small>
    </label>
  );
}
