"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, CreatorBrief, GenConfig, TextElement, GenProgress, Project, Theme } from "@/lib/types";
import { defaultTheme } from "@/lib/types";

type RawCard = { background?: string; elements?: Record<string, unknown>[] };
import { loadProjects, saveProjects } from "@/lib/store";
import { newId, normalizeCard, enforceRoles } from "@/lib/ops";
import { addUsage, type UsageEvent } from "@/lib/usage";
import { extractCards, parseStructured } from "@/lib/stream";
import { streamGenerate, streamVideoBg } from "@/lib/ai-transport";
import { uploadAttachment } from "@/lib/image";
import { dressPhotoCard, dressPlannedCard } from "@/lib/photoset";
import { shrinkDataUrl } from "@/lib/image";
import { initialWizard, type WizardState } from "@/lib/wizard";
import { entryToPost, loadLibrary, markUsed, saveLibrary, upsertPost, type RefEntry } from "@/lib/references";
import type { ReferencePost } from "@/lib/reference";
import { LangProvider, useLang } from "@/lib/i18n";
import Home from "@/components/Home";
import Editor from "@/components/Editor";
import { DesktopGate } from "@/components/Desktop";

export default function App() {
  return (
    <LangProvider>
      <Root />
      <DesktopGate />
    </LangProvider>
  );
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
  const [preflight, setPreflight] = useState(false); // video-frame pick before the editor opens
  const projectsRef = useRef<Project[]>([]);
  // The create wizard's answers live HERE, not in Home: Home unmounts while the
  // draft editor shows, and a failed run must come back with everything intact.
  // Reset only after a successful generation.
  const [wizard, setWizard] = useState<WizardState>(() => initialWizard());

  // Reference library (history + favorites). Loaded after projects so their
  // saved references can be backfilled once.
  const [refLib, setRefLib] = useState<RefEntry[]>([]);
  const refLibRef = useRef<RefEntry[]>([]);
  const commitLib = (next: RefEntry[]) => {
    refLibRef.current = next;
    setRefLib(next);
    saveLibrary(next);
  };

  useEffect(() => {
    void loadProjects().then((loaded) => {
      setProjects(loaded);
      projectsRef.current = loaded;
      void loadLibrary(loaded).then((lib) => {
        refLibRef.current = lib;
        setRefLib(lib);
      });
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

  // The wizard already fetched everything (reference post, subtitles); only a
  // YouTube source gets one more best-effort step: vision-pick a video frame
  // as the hook background + a matching accent.
  async function addReference(post: ReferencePost, opts: { favorite?: boolean; used?: boolean } = {}) {
    commitLib(await upsertPost(refLibRef.current, post, opts));
  }

  async function startGenerate(cfg: GenConfig) {
    setGenError(null);
    // Library: count this use (screenshot references get their own entry).
    const ref = cfg.referencePost;
    if (ref) {
      if (ref.url && refLibRef.current.some((e) => e.url === ref.url)) commitLib(markUsed(refLibRef.current, ref.url));
      else void addReference(ref, { used: true });
    }
    const topic = cfg.topic.trim();
    const projectName = (cfg.mode === "video" && cfg.videoTitle) || topic.split("\n")[0] || t("new_project_name");
    let bgFrame: string | undefined;
    let accent = cfg.accent;
    if (cfg.youtubeId && !cfg.photos?.length) {
      setPreflight(true);
      try {
        const pick = await pickVideoBg(cfg.youtubeId, cfg.model);
        if (pick && pick.frame >= 0) bgFrame = `/api/frame?v=${cfg.youtubeId}&n=${pick.frame}`;
        if (pick && !accent && /^#[0-9a-fA-F]{6}$/.test(pick.accent ?? "")) accent = pick.accent;
      } catch {
        /* no frame — plain generation */
      }
      setPreflight(false);
    }
    void runGenerate(
      { ...cfg, accent },
      { requestTopic: topic, projectName: projectName.slice(0, 24), bgFrame, autoName: !cfg.videoTitle },
    );
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
      bgFrame?: string;
      autoName?: boolean; // name the project after its generated cover title
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
    const estimate =
      cfg.plan?.length || cfg.cardCount || (photos.length ? Math.min(Math.max(photos.length, 4), 8) : 6);
    setGenError(null);
    setDraft(base);
    setGenProgress({ total: estimate, done: 0, phase: "prep" });

    try {
      // Photos go on cards by URL: /uploads/<hash> locally (dedup'd, same-origin
      // for export), the inline data URL when the server can't write (hosted).
      const photoUrls = await Promise.all(photos.map((p) => uploadAttachment(p.full)));
      // A plan (analysis step) fixes each card's layout + photos; without one,
      // photos cycle across cards as before.
      const plan = cfg.plan;
      const dress = (c: Card, k: number) =>
        plan?.[k]
          ? dressPlannedCard(c, plan[k], photoUrls, cfg.refStyle)
          : photoUrls.length
            ? dressPhotoCard(c, k, photoUrls, cfg.refStyle)
            : c;
      // Keep the reference for the editor's side-by-side compare (small copies).
      const refPost = cfg.referencePost;
      const referenceSnapshot = refPost
        ? {
            platform: refPost.platform,
            url: refPost.url,
            author: refPost.author,
            caption: refPost.caption.slice(0, 2000),
            slides: await Promise.all(
              refPost.slides.map(async (s) => uploadAttachment(await shrinkDataUrl(s, 480).catch(() => s))),
            ),
          }
        : undefined;

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
        noAccent: cfg.noAccent,
        reference,
        mode: cfg.mode,
        script: cfg.script,
        videoTitle: cfg.videoTitle,
        designNotes: cfg.designNotes,
        photos: photos.length ? photos.map((p) => p.api) : undefined,
        refText: cfg.refText,
        refImages: cfg.refImages,
        referencePost: cfg.referencePost,
        templateRef: cfg.templateRef,
        plan: cfg.plan,
        refStyle: cfg.refStyle,
        outputLang: cfg.outputLang,
        intent: cfg.intent,
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

      const final = parseStructured<{
        brief?: Partial<CreatorBrief>;
        theme?: Record<string, unknown>;
        cards?: Record<string, unknown>[];
      }>(
        doneText || acc,
      );
      const finalTheme = { ...defaultTheme(), ...(final.theme ?? {}) } as Theme;
      if (cfg.accent) finalTheme.accent = cfg.accent;
      if (cfg.noAccent) finalTheme.accent = finalTheme.textColor; // monochrome: accent tracks the text color
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
      // The creator brief the copy was written against — kept for chat edits.
      const b = final.brief;
      const brief: CreatorBrief | undefined =
        b || cfg.intent
          ? {
              intent: cfg.intent?.trim() || undefined,
              audience: String(b?.audience ?? ""),
              purpose: String(b?.purpose ?? ""),
              contentType: String(b?.contentType ?? ""),
              keepOriginal: Array.isArray(b?.keepOriginal) ? b.keepOriginal.map(String).slice(0, 60) : [],
              languageNote: String(b?.languageNote ?? ""),
            }
          : undefined;
      const project: Project = enforceRoles({
        ...base,
        reference: referenceSnapshot,
        brief,
        name: (req.autoName && coverName) || req.projectName || base.name,
        theme: finalTheme,
        cards,
        usage: [...(cfg.planUsage ?? []), usage].reduce<ReturnType<typeof addUsage> | undefined>(
          (acc, ev) => addUsage(acc, ev),
          undefined,
        ),
        updatedAt: Date.now(),
      });
      persist([...projectsRef.current, project]);
      setWizard(initialWizard()); // success → the next set starts fresh
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
        busy={preflight}
        wizard={wizard}
        setWizard={setWizard}
        library={refLib}
        onReferenceLoaded={(post) => void addReference(post)}
        onLibraryAdd={(post) => addReference(post, { favorite: true })}
        onLibraryFavorite={(id) =>
          commitLib(refLibRef.current.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)))
        }
        onLibraryDelete={(id) => commitLib(refLibRef.current.filter((e) => e.id !== id))}
        onLibraryUse={async (entry) => {
          const post = await entryToPost(entry);
          setWizard((w) => ({ ...w, step: 0, refSource: "url", refUrl: entry.url, refPost: post }));
          document.querySelector(".wizard")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
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
    </>
  );
}
