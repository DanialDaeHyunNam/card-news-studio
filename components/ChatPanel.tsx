"use client";

import { useRef, useState } from "react";
import type { Operation, Project } from "@/lib/types";
import { fileToAttachment, type Attachment } from "@/lib/image";
import type { UsageEvent } from "@/lib/usage";
import { useLang, type DictKey } from "@/lib/i18n";

interface ChatPanelProps {
  project: Project;
  selection: { cardId?: string; elementId?: string };
  selectionLabel: string;
  onApply: (args: {
    userText: string;
    userThumbs: string[];
    reply: string;
    operations: Operation[];
    attachmentOriginals: string[];
    usage?: UsageEvent;
  }) => void;
}

const QUICK_PROMPTS: DictKey[] = ["chat_q1", "chat_q2", "chat_q3"];

export default function ChatPanel({ project, selection, selectionLabel, onApply }: ChatPanelProps) {
  const { lang, t } = useLang();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function addFiles(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const f of imgs) {
      try {
        const att = await fileToAttachment(f);
        setAttachments((prev) => [...prev, att]);
      } catch {
        setError(t("chat_img_fail"));
      }
    }
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    const atts = attachments;
    setInput("");
    setAttachments([]);
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
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
      onApply({
        userText: message,
        userThumbs: atts.map((a) => a.thumb),
        reply: data.reply ?? "",
        operations: Array.isArray(data.operations) ? data.operations : [],
        attachmentOriginals: atts.map((a) => a.dataUrl),
        usage: data.usage,
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("chat_req_fail"));
      setInput(message);
      setAttachments(atts);
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
        {project.chat.length === 0 && (
          <p className="hint">{t("chat_hint")}</p>
        )}
        {project.chat.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.images?.map((src, j) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={j} src={src} alt="" className="chat-thumb" />
            ))}
            <div className="chat-bubble">{m.text}</div>
          </div>
        ))}
        {busy && <div className="chat-msg assistant"><div className="chat-bubble typing">{t("chat_thinking")}</div></div>}
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="quick-chips">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} className="chip" disabled={busy} onClick={() => void send(t(q))}>
            {t(q)}
          </button>
        ))}
      </div>

      {attachments.length > 0 && (
        <div className="attach-row">
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
        <button className="btn icon" title={t("chat_attach")} onClick={() => fileRef.current?.click()}>
          🖼
        </button>
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
          rows={2}
          placeholder={t("chat_ph")}
          value={input}
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
        <button className="btn primary" disabled={busy || !input.trim()} onClick={() => void send()}>
          {busy ? "…" : t("chat_send")}
        </button>
      </div>
    </aside>
  );
}
