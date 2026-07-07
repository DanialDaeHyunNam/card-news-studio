"use client";

import { useEffect, useRef, useState } from "react";
import type { GenConfig, GenProgress, Project, Theme } from "@/lib/types";
import { defaultTheme } from "@/lib/types";

type RawCard = { background?: string; elements?: Record<string, unknown>[] };
import { loadProjects, saveProjects } from "@/lib/store";
import { newId, normalizeCard } from "@/lib/ops";
import { addUsage, type UsageEvent } from "@/lib/usage";
import { readSSE, extractCards, parseStructured } from "@/lib/stream";
import { LangProvider, useLang } from "@/lib/i18n";
import Home from "@/components/Home";
import Editor from "@/components/Editor";

export default function App() {
  return (
    <LangProvider>
      <Root />
    </LangProvider>
  );
}

const YT_RE = /(youtube\.com\/(watch|shorts|live|embed)|youtu\.be\/)/;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function Root() {
  const { lang, t } = useLang();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // In-progress generation: a not-yet-persisted project the Editor renders live.
  const [draft, setDraft] = useState<Project | null>(null);
  const [genProgress, setGenProgress] = useState<GenProgress | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const projectsRef = useRef<Project[]>([]);

  useEffect(() => {
    const loaded = loadProjects();
    setProjects(loaded);
    projectsRef.current = loaded;
  }, []);

  if (!projects) return null; // avoid hydration mismatch with localStorage

  const persist = (next: Project[]) => {
    projectsRef.current = next;
    setProjects(next);
    saveProjects(next);
  };

  // Kicks off generation: opens the Editor on an empty draft immediately, then
  // streams cards into it one at a time (request: instant transition + build).
  async function startGenerate(cfg: GenConfig) {
    const id = newId();
    const isYt = YT_RE.test(cfg.topic);
    const base: Project = {
      id,
      name: cfg.topic.trim().slice(0, 24) || t("new_project_name"),
      format: cfg.format,
      theme: cfg.accent ? { ...defaultTheme(), accent: cfg.accent } : defaultTheme(),
      cards: [],
      chat: [],
      model: cfg.model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setGenError(null);
    setDraft(base);
    setGenProgress({ total: cfg.cardCount, done: 0, phase: "prep" });

    try {
      const ref = projectsRef.current.find((p) => p.id === cfg.referenceId);
      const reference = ref
        ? {
            theme: ref.theme,
            sampleTexts: ref.cards.flatMap((c) =>
              c.elements.filter((e) => e.type === "text").map((e) => (e.type === "text" ? e.text : "")),
            ),
          }
        : undefined;

      let requestTopic = cfg.topic.trim();
      let projectName = requestTopic.slice(0, 24);
      let source: Record<string, unknown> | undefined;
      if (isYt) {
        const ytRes = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: requestTopic }),
        });
        const yt = await ytRes.json();
        if (!ytRes.ok) throw new Error(yt.error || "자막을 가져오지 못했습니다.");
        const transcript = (yt.lines as { t: number; text: string }[])
          .map((l) => `[${mmss(l.t)}] ${l.text}`)
          .join("\n");
        source = { type: "youtube", url: requestTopic, title: yt.title, author: yt.author, transcript };
        projectName = (yt.title || t("yt_fallback_name")).slice(0, 24);
        requestTopic =
          lang === "ko"
            ? `아래 유튜브 영상의 자막으로 카드뉴스를 만들어줘: ${yt.title}`
            : `Create a card set from this YouTube video's captions: ${yt.title}`;
        setDraft((d) => (d && d.id === id ? { ...d, name: projectName } : d));
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: requestTopic,
          format: cfg.format,
          cardCount: cfg.cardCount,
          model: cfg.model,
          accent: cfg.accent,
          reference,
          source,
          lang,
        }),
      });
      if (!res.headers.get("content-type")?.includes("event-stream")) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `생성 실패 (${res.status})`);
      }

      let acc = "";
      let doneText = "";
      let usage: UsageEvent | undefined;
      for await (const ev of readSSE(res)) {
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
              .map((c) => normalizeCard(c as RawCard, nextTheme));
            return { ...d, theme: nextTheme, cards: [...d.cards, ...added] };
          });
          setGenProgress((g) => (g ? { total: g.total, done: partial.cards.length, phase: "cards" } : g));
        } else if (ev.type === "error") {
          throw new Error(ev.error);
        } else if (ev.type === "done") {
          doneText = ev.text || acc;
          usage = ev.usage;
        }
      }

      const final = parseStructured<{
        theme?: Record<string, unknown>;
        cards?: Record<string, unknown>[];
      }>(doneText || acc);
      const finalTheme = { ...defaultTheme(), ...(final.theme ?? {}) } as Theme;
      if (cfg.accent) finalTheme.accent = cfg.accent;
      const cards = (final.cards ?? []).map((c) => normalizeCard(c as RawCard, finalTheme));
      if (cards.length === 0) throw new Error("생성된 카드가 없습니다. 다시 시도해 주세요.");
      const project: Project = {
        ...base,
        name: projectName || base.name,
        theme: finalTheme,
        cards,
        usage: addUsage(undefined, usage),
        updatedAt: Date.now(),
      };
      persist([...projectsRef.current, project]);
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

  const open = openId ? projects.find((p) => p.id === openId) : undefined;
  if (open) {
    return (
      <Editor
        project={open}
        onChange={(p) => persist(projects.map((x) => (x.id === p.id ? p : x)))}
        onClose={() => setOpenId(null)}
      />
    );
  }

  return (
    <Home
      projects={projects}
      error={genError}
      onGenerate={startGenerate}
      onOpen={setOpenId}
      onCreate={(p) => {
        persist([...projects, p]);
        setOpenId(p.id);
      }}
      onDelete={(id) => persist(projects.filter((p) => p.id !== id))}
    />
  );
}
