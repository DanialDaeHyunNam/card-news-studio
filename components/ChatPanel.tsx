"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Operation, Project } from "@/lib/types";
import { fileToAttachment, shrinkDataUrl, srcToModelImage, uploadAttachment, type Attachment } from "@/lib/image";
import {
  activeMentionQuery,
  buildMentionables,
  filterMentionables,
  hasToken,
  removeToken,
  MENTION_TOKEN_RE,
  type Mentionable,
} from "@/lib/mentions";
import { fetchInstagram, findInstagramUrl } from "@/lib/instagram";
import type { ChatMention, InstagramRef } from "@/lib/requests";
import type { UsageEvent } from "@/lib/usage";
import { getTemplates, instantiateTemplate, type Template } from "@/lib/templates";
import { extractReply, parseStructured } from "@/lib/stream";
import { streamChat } from "@/lib/ai-transport";
import { useClickOutside } from "@/lib/hooks";
import { useLang, type DictKey } from "@/lib/i18n";
import CardView from "./CardView";

interface ChatPanelProps {
  project: Project;
  selection: { cardId?: string; elementId?: string };
  selectionLabel: string;
  disabled?: boolean;
  // When set (hosted deploy without a key for this project's model), sending
  // intercepts to this instead of running — it opens the key modal.
  onBlocked?: () => void;
  // Register a callback so the inspector's @ buttons can drop a reference token
  // into the chat input.
  onRegisterInsert?: (fn: (t: string) => void) => void;
  onApply: (args: {
    userText: string;
    userThumbs: string[];
    reply: string;
    operations: Operation[];
    attachmentOriginals: string[];
    usage?: UsageEvent;
  }) => void;
}

const QUICK_PROMPTS: DictKey[] = ["chat_q1", "chat_q2", "chat_q3", "chat_q4"];

export default function ChatPanel({ project, selection, selectionLabel, disabled, onBlocked, onRegisterInsert, onApply }: ChatPanelProps) {
  const { lang, t } = useLang();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tplRef, setTplRef] = useState<Template | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [openOps, setOpenOps] = useState<number | null>(null); // expanded change list
  // Transient turn shown while streaming, before it lands in project.chat.
  const [streamUser, setStreamUser] = useState<{ text: string; thumbs: string[] } | null>(null);
  const [streamReply, setStreamReply] = useState("");
  // A pasted Instagram link is read before the turn is sent (slides → model).
  const [igReading, setIgReading] = useState(false);
  const igCache = useRef(new Map<string, { ref: InstagramRef; thumbs: string[] }>());
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // @-mentions: typing "@" opens a preview picker of this project's cards and
  // images (+ recent uploads); picks become tokens + chips, resolved on send.
  const [uploads, setUploads] = useState<string[]>([]);
  const [mentions, setMentions] = useState<Mentionable[]>([]);
  const [mq, setMq] = useState<{ start: number; query: string } | null>(null);
  const [mqIdx, setMqIdx] = useState(0);
  useEffect(() => {
    fetch("/api/asset")
      .then((r) => r.json())
      .then((d) => setUploads((d.uploads ?? []).map((u: { url: string }) => u.url)))
      .catch(() => {});
  }, [project.id]);
  const mentionables = useMemo(() => buildMentionables(project, uploads, lang), [project, uploads, lang]);
  const mqItems = mq ? filterMentionables(mentionables, mq.query) : [];

  function syncMentionQuery(text: string, caret: number) {
    const next = activeMentionQuery(text, caret);
    setMq(next);
    if (next?.query !== mq?.query) setMqIdx(0);
  }

  function pickMention(m: Mentionable) {
    if (!mq) return;
    const caret = inputRef.current?.selectionStart ?? input.length;
    const next = input.slice(0, mq.start) + m.token + " " + input.slice(caret);
    const pos = mq.start + m.token.length + 1;
    setInput(next);
    setMq(null);
    setMentions((cur) => (cur.some((x) => x.token === m.token) ? cur : [...cur, m]));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function removeMention(m: Mentionable) {
    setMentions((cur) => cur.filter((x) => x.token !== m.token));
    setInput((cur) => removeToken(cur, m.token));
  }

  // Let the inspector's @ buttons append a reference into the input + focus it.
  useEffect(() => {
    onRegisterInsert?.((token) => {
      setInput((prev) => (prev && !prev.endsWith(" ") ? prev + " " : prev) + token + " ");
      inputRef.current?.focus();
    });
  }, [onRegisterInsert]);
  const tplWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(tplWrapRef, () => setTplOpen(false), tplOpen);

  // Thumbnail previews for the template-reference menu (instantiated once per lang).
  const templatePreviews = useMemo(
    () =>
      getTemplates(lang).map((tpl) => {
        const project = instantiateTemplate(tpl);
        return { tpl, firstCard: project.cards[0], theme: project.theme };
      }),
    [lang],
  );
  const activeTpl = tplRef ? (templatePreviews.find((p) => p.tpl.id === tplRef.id) ?? null) : null;

  function scrollDown() {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
  }

  // On open (and when switching to a different project), pin the chat to the
  // latest message. The 150ms re-scroll covers chat image thumbnails painting.
  useEffect(() => {
    const toBottom = () => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const t = setTimeout(toBottom, 150);
    return () => clearTimeout(t);
  }, [project.id]);

  async function addFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const f of imgs) {
      try {
        const att = await fileToAttachment(f);
        att.url = await uploadAttachment(att.dataUrl); // save locally → short URL
        setAttachments((prev) => [...prev, att]);
      } catch {
        setError(t("chat_img_fail"));
      }
    }
  }

  async function send(text?: string) {
    // Hosted without a key for this model — route to the key modal, don't fail.
    if (onBlocked) return onBlocked();
    const message = (text ?? input).trim();
    if (!message || busy || disabled) return;
    setBusy(true);
    setError(null);
    const atts = attachments;
    const userThumbs = atts.map((a) => a.thumb);
    setStreamUser({ text: message, thumbs: userThumbs });
    setStreamReply("");
    setInput("");
    setAttachments([]);
    const tagged = mentions.filter((m) => hasToken(message, m.token));
    setMentions([]);
    setMq(null);
    scrollDown();
    const tpl = tplRef;
    try {
      // Tagged images join this turn's attachments (the model sees them; ops
      // place them via attachment:N → the original src). Cards map to ids.
      const mentionImgs = await Promise.all(
        tagged
          .filter((m): m is Extract<Mentionable, { kind: "image" }> => m.kind === "image")
          .map(async (m) => ({ m, img: await srcToModelImage(m.src) })),
      );
      const chatMentions: ChatMention[] = tagged.map((m) => {
        if (m.kind === "card") return { token: m.token, kind: "card", n: m.n, cardId: m.cardId };
        const i = mentionImgs.findIndex((x) => x.m.token === m.token);
        return { token: m.token, kind: "image", src: m.src, attachmentIndex: atts.length + i, usedIn: m.usedIn };
      });
      const turnAtts = [
        ...atts.map((a) => ({ apiDataUrl: a.apiDataUrl, width: a.width, height: a.height, bg: a.bg, bgUniform: a.bgUniform })),
        ...mentionImgs.map(({ img }) => ({ apiDataUrl: img.apiDataUrl, width: img.width, height: img.height })),
      ];
      const mentionThumbs = mentionImgs.map(({ img }) => img.thumb);
      if (mentionThumbs.length) setStreamUser({ text: message, thumbs: [...userThumbs, ...mentionThumbs] });

      // Instagram link in the message → fetch every slide as a style reference.
      // Cached per URL so a retry / follow-up with the same link is instant.
      let instagram: InstagramRef | undefined;
      let igThumbs: string[] = [];
      const igUrl = findInstagramUrl(message);
      if (igUrl) {
        let hit = igCache.current.get(igUrl);
        if (!hit) {
          setIgReading(true);
          try {
            const ref = await fetchInstagram(igUrl);
            const thumbs = await Promise.all(ref.slides.slice(0, 4).map((s) => shrinkDataUrl(s, 120)));
            hit = { ref, thumbs };
            igCache.current.set(igUrl, hit);
          } finally {
            setIgReading(false);
          }
        }
        instagram = hit.ref;
        igThumbs = hit.thumbs;
        setStreamUser({ text: message, thumbs: [...userThumbs, ...mentionThumbs, ...igThumbs] });
      }

      let acc = "";
      let doneText = "";
      let usage: UsageEvent | undefined;
      for await (const ev of streamChat({
        project: { ...project, chat: [] },
        selection,
        history: project.chat.map((m) => ({ role: m.role, text: m.text })),
        message,
        attachments: turnAtts,
        mentions: chatMentions.length ? chatMentions : undefined,
        templateRef: tpl ? { name: tpl.name, theme: tpl.theme, cards: tpl.cards } : undefined,
        instagram,
        lang,
      })) {
        if (ev.type === "delta") {
          acc += ev.text ?? "";
          setStreamReply(extractReply(acc));
          scrollDown();
        } else if (ev.type === "error") {
          throw new Error(ev.error || t("chat_req_fail"));
        } else if (ev.type === "done") {
          doneText = ev.text || acc;
          usage = ev.usage;
        }
      }

      const parsed = parseStructured<{ reply?: string; operations?: unknown }>(doneText || acc);
      onApply({
        userText: message,
        userThumbs: [...userThumbs, ...mentionThumbs, ...igThumbs],
        reply: parsed.reply ?? extractReply(acc),
        operations: Array.isArray(parsed.operations) ? (parsed.operations as Operation[]) : [],
        attachmentOriginals: [...atts.map((a) => a.url ?? a.dataUrl), ...mentionImgs.map(({ m }) => m.src)],
        usage,
      });
      setStreamUser(null);
      setStreamReply("");
      scrollDown();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat_req_fail"));
      setInput(message);
      setAttachments(atts);
      setMentions(tagged);
      setStreamUser(null);
      setStreamReply("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="chat-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles(e.dataTransfer.files);
      }}
    >
      <div className="panel-title">
        {t("chat_title")} <span className="selection-chip">{selectionLabel}</span>
      </div>

      <div className="chat-list" ref={listRef}>
        {project.chat.length === 0 && !streamUser && <p className="hint">{t("chat_hint")}</p>}
        {project.chat.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.images?.map((src, j) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={j} src={src} alt="" className="chat-thumb" />
            ))}
            <div className="chat-bubble">{withMentions(m.text)}</div>
            {m.role === "assistant" && m.ops !== undefined && (
              <div className="chat-done">
                <button
                  className={`chat-done-btn ${m.opsSummary ? "clickable" : ""}`}
                  onClick={() => m.opsSummary && setOpenOps(openOps === i ? null : i)}
                >
                  ✓ {m.ops > 0 ? `${m.ops}${t("chat_applied")}` : t("chat_no_change")}
                  {m.opsSummary && <span className="chat-done-caret">{openOps === i ? "▲" : "▾"}</span>}
                </button>
                {openOps === i && m.opsSummary && (
                  <ul className="chat-ops">
                    {m.opsSummary.split("\n").map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        {streamUser && (
          <div className="chat-msg user">
            {streamUser.thumbs.map((src, j) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={j} src={src} alt="" className="chat-thumb" />
            ))}
            <div className="chat-bubble">{withMentions(streamUser.text)}</div>
          </div>
        )}
        {busy && (
          <div className="chat-msg assistant">
            {streamReply ? (
              <div className="chat-bubble">
                {streamReply}
                <span className="stream-caret" />
              </div>
            ) : (
              <div className="chat-bubble typing">
                <span className="btn-spinner dark" /> {igReading ? t("chat_ig_reading") : t("chat_thinking")}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {/* Preset prompts — only on a fresh chat; they vanish once a turn exists. */}
      {project.chat.length === 0 && !streamUser && (
        <div className="quick-chips">
          {QUICK_PROMPTS.map((q) => (
            <button key={q} className="chip" disabled={busy || disabled} onClick={() => void send(t(q))}>
              {t(q)}
            </button>
          ))}
        </div>
      )}

      {/* Thumbnails: referenced template + attached images, side by side. */}
      {(activeTpl || attachments.length > 0 || mentions.length > 0) && (
        <div className="attach-row">
          {activeTpl && (
            <div className="ref-tpl-item">
              <span className="ref-tpl-thumb">
                <CardView
                  card={activeTpl.firstCard}
                  theme={activeTpl.theme}
                  format={activeTpl.tpl.format}
                  width={34}
                />
              </span>
              <span className="ref-tpl-meta">
                <b>{activeTpl.tpl.name}</b>
                <small>{t("chat_tpl_active")}</small>
              </span>
              <button onClick={() => setTplRef(null)} title="✕">
                ✕
              </button>
            </div>
          )}
          {mentions.map((m) => (
            <div key={m.token} className="mention-chip" title={m.token}>
              <MentionPreview m={m} project={project} size={30} />
              <b>{m.token}</b>
              <button onClick={() => removeMention(m)}>✕</button>
            </div>
          ))}
          {attachments.map((a) => (
            <div key={a.id} className="attach-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumb} alt="" />
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}>✕</button>
            </div>
          ))}
        </div>
      )}

      {busy && (
        <div className="chat-status">
          <span className="btn-spinner dark" /> {t("chat_working")}
        </div>
      )}

      <div className="chat-input-row">
        <div className="chat-actions">
          <button
            className="btn icon attach-btn"
            title={t("chat_attach")}
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            +
          </button>
          <div className="tpl-ref-wrap" ref={tplWrapRef}>
            <button
              className={`btn icon attach-btn tpl-btn ${tplRef ? "on" : ""}`}
              disabled={busy || disabled}
              onClick={() => setTplOpen((v) => !v)}
              title={t("chat_tpl_pick")}
            >
              ◫
            </button>
            {tplOpen && (
              <div className="tpl-ref-menu">
                {templatePreviews.map(({ tpl, firstCard, theme }) => (
                  <button
                    key={tpl.id}
                    className={`tpl-ref-item ${tplRef?.id === tpl.id ? "on" : ""}`}
                    onClick={() => {
                      setTplRef(tpl);
                      setTplOpen(false);
                    }}
                  >
                    <span className="tpl-ref-thumb">
                      <CardView card={firstCard} theme={theme} format={tpl.format} width={48} />
                    </span>
                    <span className="tpl-ref-text">
                      <b>{tpl.name}</b>
                      <small>{tpl.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {mq && mqItems.length > 0 && (
          <div className="mention-menu" role="listbox">
            <div className="mention-head">{t("mention_head")}</div>
            {mqItems.map((m, i) => (
              <button
                key={m.token}
                ref={(el) => {
                  if (i === mqIdx) el?.scrollIntoView({ block: "nearest" }); // keep keyboard pick visible
                }}
                role="option"
                aria-selected={i === mqIdx}
                className={`mention-item ${i === mqIdx ? "on" : ""}`}
                onMouseEnter={() => setMqIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep textarea focus/caret
                  pickMention(m);
                }}
              >
                <MentionPreview m={m} project={project} size={40} />
                <span className="mention-text">
                  <b>{m.token}</b>
                  <small>
                    {m.kind === "card"
                      ? cardSummary(m.card)
                      : m.usedIn.length
                        ? t("mention_used_in").replace("{n}", m.usedIn.join(", "))
                        : t("mention_upload")}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={3}
          placeholder={t("chat_ph")}
          value={input}
          disabled={disabled}
          onChange={(e) => {
            setInput(e.target.value);
            syncMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={(e) => syncMentionQuery(input, e.currentTarget.selectionStart ?? input.length)}
          onBlur={() => setMq(null)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (mq && mqItems.length > 0) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const d = e.key === "ArrowDown" ? 1 : -1;
                setMqIdx((i) => (i + d + mqItems.length) % mqItems.length);
                return;
              }
              if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
                e.preventDefault();
                pickMention(mqItems[Math.min(mqIdx, mqItems.length - 1)]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMq(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn primary chat-send" disabled={busy || disabled || !input.trim()} onClick={() => void send()}>
          {busy ? <span className="btn-spinner" /> : t("chat_send")}
        </button>
      </div>
    </aside>
  );
}

// First text on a card, as the picker's one-line description.
function cardSummary(card: Project["cards"][number]): string {
  const text = card.elements.find((e) => e.type === "text");
  return text && text.type === "text" ? text.text.replace(/\s+/g, " ").slice(0, 28) : "";
}

function MentionPreview({ m, project, size }: { m: Mentionable; project: Project; size: number }) {
  if (m.kind === "card") {
    return (
      <span className="mention-thumb" style={{ width: size }}>
        <CardView card={m.card} theme={project.theme} format={project.format} width={size} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="mention-thumb img" src={m.src} alt="" style={{ width: size, height: size }} />
  );
}

// Render @카드N / @사진N tokens as highlighted pills inside chat bubbles.
function withMentions(text: string) {
  const parts = text.split(MENTION_TOKEN_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="mention-pill">
        {p}
      </span>
    ) : (
      p
    ),
  );
}
