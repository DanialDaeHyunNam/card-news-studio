"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Operation, Project } from "@/lib/types";
import { fileToAttachment, uploadAttachment, type Attachment } from "@/lib/image";
import type { UsageEvent } from "@/lib/usage";
import { getTemplates, instantiateTemplate, type Template } from "@/lib/templates";
import { readSSE, extractReply, parseStructured } from "@/lib/stream";
import { useClickOutside } from "@/lib/hooks";
import { useLang, type DictKey } from "@/lib/i18n";
import CardView from "./CardView";

interface ChatPanelProps {
  project: Project;
  selection: { cardId?: string; elementId?: string };
  selectionLabel: string;
  disabled?: boolean;
  // When set (hosted deploy), sending intercepts to this instead of hitting the
  // server — the AI edit needs a local key, so it routes to the install guide.
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
  // Transient turn shown while streaming, before it lands in project.chat.
  const [streamUser, setStreamUser] = useState<{ text: string; thumbs: string[] } | null>(null);
  const [streamReply, setStreamReply] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    // Hosted deploy: no local key, so the AI edit can't run — show how to run
    // it locally instead of failing.
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
    scrollDown();
    const tpl = tplRef;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: { ...project, chat: [] },
          selection,
          history: project.chat.map((m) => ({ role: m.role, text: m.text })),
          message,
          attachments: atts.map((a) => ({ apiDataUrl: a.apiDataUrl, width: a.width, height: a.height })),
          templateRef: tpl ? { name: tpl.name, theme: tpl.theme, cards: tpl.cards } : undefined,
          lang,
        }),
      });

      // Validation failures come back as JSON, not an event stream.
      if (!res.headers.get("content-type")?.includes("event-stream")) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `요청 실패 (${res.status})`);
      }

      let acc = "";
      let doneText = "";
      let usage: UsageEvent | undefined;
      for await (const ev of readSSE(res)) {
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
        userThumbs,
        reply: parsed.reply ?? extractReply(acc),
        operations: Array.isArray(parsed.operations) ? (parsed.operations as Operation[]) : [],
        attachmentOriginals: atts.map((a) => a.url ?? a.dataUrl),
        usage,
      });
      setStreamUser(null);
      setStreamReply("");
      scrollDown();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat_req_fail"));
      setInput(message);
      setAttachments(atts);
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
            <div className="chat-bubble">{m.text}</div>
            {m.role === "assistant" && m.ops !== undefined && (
              <div className="chat-done">
                ✓ {m.ops > 0 ? `${m.ops}${t("chat_applied")}` : t("chat_no_change")}
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
            <div className="chat-bubble">{streamUser.text}</div>
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
                <span className="btn-spinner dark" /> {t("chat_thinking")}
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
      {(activeTpl || attachments.length > 0) && (
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
          {attachments.map((a) => (
            <div key={a.id} className="attach-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.thumb} alt="" />
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}>✕</button>
            </div>
          ))}
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
        <textarea
          ref={inputRef}
          rows={3}
          placeholder={t("chat_ph")}
          value={input}
          disabled={disabled}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          onKeyDown={(e) => {
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
