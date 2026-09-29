"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, GenConfig, TextElement, GenProgress, Project, Theme } from "@/lib/types";
import { defaultTheme } from "@/lib/types";

type RawCard = { background?: string; elements?: Record<string, unknown>[] };
import { loadProjects, saveProjects } from "@/lib/store";
import { newId, normalizeCard, enforceRoles } from "@/lib/ops";
import { addUsage, type UsageEvent } from "@/lib/usage";
import { extractCards, parseStructured } from "@/lib/stream";
import { streamGenerate, streamVideoBg } from "@/lib/ai-transport";
import type { GenerateBody, InstagramRef } from "@/lib/requests";
import { uploadAttachment } from "@/lib/image";
import { dressPhotoCard } from "@/lib/photoset";
import { IG_URL_RE, fetchInstagram } from "@/lib/instagram";
import { LangProvider, useLang } from "@/lib/i18n";
import Home from "@/components/Home";
import Editor from "@/components/Editor";
import SegmentPicker from "@/components/SegmentPicker";

export default function App() {
  return (
    <LangProvider>
      <Root />
    </LangProvider>
  );
}

const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
// Above this length we ask which segment to use — otherwise the transcript is
// truncated to ~16k chars server-side and the tail is silently dropped.
const LONG_SECONDS = 20 * 60;

interface YtResult {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  lines: { t: number; text: string }[];
}

function Root() {
  const { lang, t } = useLang();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // In-progress generation: a not-yet-persisted project the Editor renders live.
  const [draft, setDraft] = useState<Project | null>(null);
  // A template/blank opened for preview but NOT yet saved. It only joins the
  // saved list once its CONTENT changes — merely opening one shouldn't clutter
  // the project list. unsavedSig is the content fingerprint at open time.
  const [unsaved, setUnsaved] = useState<Project | null>(null);
  const unsavedSig = useRef<string | null>(null);
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // YouTube pre-flight: fetching captions / analyzing frames before the editor
  // opens, plus the segment picker for long videos.
  const [ytBusy, setYtBusy] = useState(false);
  const [ytPending, setYtPending] = useState<{ cfg: GenConfig; yt: YtResult } | null>(null);
  const projectsRef = useRef<Project[]>([]);
  // The last generate request, handed back to Home so a failed run doesn't wipe
  // the attached photos / script (Home unmounts while the draft editor shows).
  const [lastCfg, setLastCfg] = useState<GenConfig | null>(null);

  useEffect(() => {
    void loadProjects().then((loaded) => {
      setProjects(loaded);
      projectsRef.current = loaded;
    });
  }, []);

  if (!projects) return null; // avoid hydration mismatch (store loads client-side)

  const persist = (next: Project[]) => {
    projectsRef.current = next;
    setProjects(next);
    saveProjects(next);
  };

  // Content fingerprint of a project — deliberately excludes model/usage/updatedAt
  // so the mount-time model auto-switch doesn't count as a user edit.
  const contentSig = (p: Project) => JSON.stringify([p.name, p.theme, p.styles ?? null, p.cards, p.chat.length]);

  // Non-YouTube generates straight away; YouTube pre-fetches captions first (and
  // asks for a segment on long videos) before generating.
  function startGenerate(cfg: GenConfig) {
    setLastCfg(cfg);
    if (IG_URL_RE.test(cfg.topic)) {
      void beginInstagram(cfg);
    } else if (YT_RE.test(cfg.topic)) {
      void beginYoutube(cfg);
    } else {
      const topic = cfg.topic.trim();
      void runGenerate(cfg, { requestTopic: topic, projectName: nameFor(topic, cfg), autoName: !topic });
    }
  }

  // Topic → else first script line → else a generic name.
  function nameFor(topic: string, cfg: GenConfig, fallback?: string): string {
    const firstLine = cfg.refText?.split("\n").find((l) => l.trim())?.trim();
    return (topic || firstLine || fallback || t("new_project_name")).slice(0, 24);
  }

  // Instagram link in the bar: read every slide + caption/counts first, then
  // generate with the post as the benchmark. Text around the link stays the topic.
  async function beginInstagram(cfg: GenConfig) {
    const url = IG_URL_RE.exec(cfg.topic)?.[0] ?? "";
    const rest = cfg.topic.replace(url, "").trim();
    setGenError(null);
    setYtBusy(true);
    try {
      const ig = await fetchInstagram(url);
      setYtBusy(false);
      const requestTopic =
        rest ||
        (lang === "ko"
          ? "레퍼런스 인스타 게시물의 형식을 벤치마킹해서 카드뉴스를 만들어줘"
          : "Create a card set benchmarking the reference Instagram post's format");
      void runGenerate(cfg, {
        requestTopic,
        projectName: nameFor(rest, cfg, ig.username ? `@${ig.username} ref` : undefined),
        instagram: ig,
        autoName: !rest,
      });
    } catch (e) {
      setYtBusy(false);
      setGenError(e instanceof Error ? e.message : "인스타 게시물을 읽지 못했습니다.");
    }
  }

  async function beginYoutube(cfg: GenConfig) {
    setGenError(null);
    setYtBusy(true);
    try {
      const ytRes = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cfg.topic.trim() }),
      });
      const yt = (await ytRes.json()) as YtResult & { error?: string };
      if (!ytRes.ok) throw new Error(yt.error || "자막을 가져오지 못했습니다.");
      setYtBusy(false);
      if ((yt.duration || 0) >= LONG_SECONDS) {
        setYtPending({ cfg, yt }); // long → ask which segment
      } else {
        void runYoutube(cfg, yt, 0, yt.duration || Number.MAX_SAFE_INTEGER);
      }
    } catch (e) {
      setYtBusy(false);
      setGenError(e instanceof Error ? e.message : "자막을 가져오지 못했습니다.");
    }
  }

  async function runYoutube(cfg: GenConfig, yt: YtResult, startSec: number, endSec: number) {
    setYtPending(null);
    let lines = yt.lines.filter((l) => l.t >= startSec && l.t < endSec);
    if (lines.length === 0) lines = yt.lines; // no captions in range → use all
    const transcript = lines.map((l) => `[${mmss(l.t)}] ${l.text}`).join("\n");
    const projectName = (yt.title || t("yt_fallback_name")).slice(0, 24);
    const requestTopic =
      lang === "ko"
        ? `아래 유튜브 영상의 자막으로 카드뉴스를 만들어줘: ${yt.title}`
        : `Create a card set from this YouTube video's captions: ${yt.title}`;
    const source = { type: "youtube", url: cfg.topic.trim(), title: yt.title, author: yt.author, transcript };

    // Vision-pick a video frame for the background + a matching accent. Best
    // effort — any failure just generates without a video background.
    let bgFrame: string | undefined;
    let accent = cfg.accent;
    setYtBusy(true);
    try {
      const pick = await pickVideoBg(yt.videoId, cfg.model);
      if (pick && pick.frame >= 0) bgFrame = `/api/frame?v=${yt.videoId}&n=${pick.frame}`;
      if (pick && !accent && /^#[0-9a-fA-F]{6}$/.test(pick.accent ?? "")) accent = pick.accent;
    } catch {
      /* no frame — plain generation */
    }
    setYtBusy(false);
    void runGenerate({ ...cfg, accent }, { requestTopic, projectName, source, bgFrame });
  }

  async function pickVideoBg(videoId: string, model: string): Promise<{ frame: number; accent: string } | null> {
    let acc = "";
    let doneText = "";
    for await (const ev of streamVideoBg(videoId, model, lang)) {
      if (ev.type === "delta") acc += ev.text ?? "";
      else if (ev.type === "done") doneText = ev.text || acc;
      else if (ev.type === "error") return null;
    }
    try {
      return parseStructured<{ frame: number; accent: string }>(doneText || acc);
    } catch {
      return null;
    }
  }

  // Opens the Editor on an empty draft immediately, then streams cards into it.
  async function runGenerate(
    cfg: GenConfig,
    req: {
      requestTopic: string;
      projectName: string;
      source?: Record<string, unknown>;
      bgFrame?: string;
      instagram?: InstagramRef;
      autoName?: boolean; // no topic typed → name the project after its cover title
    },
  ) {
    const id = newId();
    const base: Project = {
      id,
      name: req.projectName || t("new_project_name"),
      format: cfg.format,
      theme: cfg.accent ? { ...defaultTheme(), accent: cfg.accent } : defaultTheme(),
      cards: [],
      chat: [],
      model: cfg.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const photos = cfg.photos ?? [];
    // Auto count: a placeholder estimate for the skeleton strip until cards land.
    const estimate = cfg.cardCount || (photos.length ? Math.min(Math.max(photos.length, 4), 8) : 6);
    setGenError(null);
    setDraft(base);
    setGenProgress({ total: estimate, done: 0, phase: "prep" });

    try {
      // Photos go on cards by URL: /uploads/<hash> locally (dedup'd, same-origin
      // for export), the inline data URL when the server can't write (hosted).
      const photoUrls = await Promise.all(photos.map((p) => uploadAttachment(p.full)));
      const dress = (c: Card, k: number) => (photoUrls.length ? dressPhotoCard(c, k, photoUrls) : c);

      const ref = projectsRef.current.find((p) => p.id === cfg.referenceId);
      const reference = ref
        ? {
            theme: ref.theme,
            sampleTexts: ref.cards.flatMap((c) =>
              c.elements.filter((e) => e.type === "text").map((e) => (e.type === "text" ? e.text : "")),
            ),
          }
        : undefined;

      let acc = "";
      let doneText = "";
      let usage: UsageEvent | undefined;
      for await (const ev of streamGenerate({
        topic: req.requestTopic,
        format: cfg.format,
        cardCount: cfg.cardCount,
        model: cfg.model,
        accent: cfg.accent,
        reference,
        source: req.source as GenerateBody["source"],
        photos: photos.length ? photos.map((p) => p.api) : undefined,
        refText: cfg.refText,
        refImages: cfg.refImages,
        instagram: req.instagram,
        lang,
      })) {
        if (ev.type === "delta") {
          acc += ev.text ?? "";
          const partial = extractCards(acc);
          const theme = partial.theme
            ? ({ ...defaultTheme(), ...partial.theme, ...(cfg.accent ? { accent: cfg.accent } : {}) } as Theme)
            : undefined;
          // Append only newly-CLOSED cards so existing card ids stay stable
          // (stable keys → clean per-card entrance animation, no re-mount churn).
          setDraft((d) => {
            if (!d || d.id !== id) return d;
            const nextTheme = theme ?? d.theme;
            if (partial.cards.length <= d.cards.length) {
              return theme ? { ...d, theme: nextTheme } : d;
            }
            const added = partial.cards
              .slice(d.cards.length)
              .map((c, i) => dress(normalizeCard(c as RawCard, nextTheme), d.cards.length + i));
            return { ...d, theme: nextTheme, cards: [...d.cards, ...added] };
          });
          setGenProgress((g) =>
            g ? { total: Math.max(g.total, partial.cards.length), done: partial.cards.length, phase: "cards" } : g,
          );
        } else if (ev.type === "error") {
          throw new Error(ev.error);
        } else if (ev.type === "done") {
          doneText = ev.text || acc;
          usage = ev.usage;
        }
      }

      const final = parseStructured<{ theme?: Record<string, unknown>; cards?: Record<string, unknown>[] }>(
        doneText || acc,
      );
      const finalTheme = { ...defaultTheme(), ...(final.theme ?? {}) } as Theme;
      if (cfg.accent) finalTheme.accent = cfg.accent;
      const cards = (final.cards ?? []).map((c, k) => dress(normalizeCard(c as RawCard, finalTheme), k));
      if (cards.length === 0) throw new Error("생성된 카드가 없습니다. 다시 시도해 주세요.");
      // Video frame → hook card background (heavy dark dim keeps light text legible).
      if (req.bgFrame && photoUrls.length === 0) {
        cards[0] = {
          ...cards[0],
          background: `linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.72) 100%), url(${req.bgFrame}) center/cover no-repeat`,
        };
      }
      // enforceRoles unifies same-role text styles + records project.styles, so
      // the set is consistent even if the model drifted card to card.
      const coverTitle = cards[0]?.elements.find(
        (e): e is TextElement => e.type === "text" && (e.role === "mega" || e.role === "title"),
      );
      const coverName = coverTitle?.text.replace(/\s+/g, " ").trim().slice(0, 24);
      const project: Project = enforceRoles({
        ...base,
        name: (req.autoName && coverName) || req.projectName || base.name,
        theme: finalTheme,
        cards,
        usage: addUsage(undefined, usage),
        updatedAt: Date.now(),
      });
      persist([...projectsRef.current, project]);
      setLastCfg(null);
      setDraft(null);
      setGenProgress(null);
      setOpenId(project.id);
    } catch (e) {
      setDraft(null);
      setGenProgress(null);
      setGenError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    }
  }

  if (draft) {
    return (
      <Editor
        project={draft}
        generating={genProgress}
        onChange={(p) => setDraft((cur) => (cur && cur.id === p.id ? p : cur))}
        onClose={() => {
          setDraft(null);
          setGenProgress(null);
        }}
      />
    );
  }

  // Editor target: an unsaved preview (same id as openId) wins over a saved one.
  const savedOpen = openId ? projects.find((p) => p.id === openId) : undefined;
  const editing = unsaved && unsaved.id === openId ? unsaved : savedOpen;
  if (editing) {
    const isUnsaved = editing === unsaved;
    return (
      <Editor
        project={editing}
        onChange={(p) => {
          if (isUnsaved) {
            // First real content change promotes the preview into the saved list.
            if (contentSig(p) !== unsavedSig.current) {
              unsavedSig.current = null;
              setUnsaved(null);
              persist([...projectsRef.current, p]);
            } else {
              setUnsaved(p); // keep live (e.g. model auto-switch) without saving
            }
          } else {
            persist(projectsRef.current.map((x) => (x.id === p.id ? p : x)));
          }
        }}
        onClose={() => {
          setUnsaved(null);
          unsavedSig.current = null;
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <>
      <Home
        projects={projects}
        error={genError}
        busy={ytBusy}
        initial={genError ? lastCfg : null}
        onGenerate={startGenerate}
        onOpen={setOpenId}
        onCreate={(p) => {
          // Open for preview only — saved on first content edit (see editing branch).
          setUnsaved(p);
          unsavedSig.current = contentSig(p);
          setOpenId(p.id);
        }}
        onDelete={(id) => persist(projects.filter((p) => p.id !== id))}
        onImport={(p) => {
          persist([...projectsRef.current, p]);
          setOpenId(p.id);
        }}
      />
      {ytPending && (
        <SegmentPicker
          title={ytPending.yt.title || t("yt_fallback_name")}
          durationSec={ytPending.yt.duration}
          onConfirm={(s, e) => void runYoutube(ytPending.cfg, ytPending.yt, s, e)}
          onClose={() => setYtPending(null)}
        />
      )}
    </>
  );
}
