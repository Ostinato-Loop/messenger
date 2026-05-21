import { AnimatePresence, motion } from "framer-motion";
import { FileText, Mic, MicOff, Paperclip, Send, X, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Message } from "@/hooks/useMessaging";

type Props = {
  onSend: (text: string, replyTo?: string, mediaFile?: File) => void | Promise<void>;
  onTyping: (typing: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
};

type AttachPreview = {
  file: File;
  previewUrl: string | null;
  kind: "image" | "audio" | "file";
};

export function ChatComposer({ onSend, onTyping, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState("");
  const [attach, setAttach] = useState<AttachPreview | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [text]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (attach?.previewUrl) URL.revokeObjectURL(attach.previewUrl);
    };
  }, [attach]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 2000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
      ? "audio"
      : "file";
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : null;
    setAttach({ file, previewUrl, kind });
    e.target.value = "";
  }

  async function startRecording() {
    if (!navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recChunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setAttach({ file, previewUrl: null, kind: "audio" });
      };
      mr.start(200);
      recorderRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recTimer.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      // mic permission denied — silently ignore
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (recTimer.current) clearInterval(recTimer.current);
    recTimer.current = null;
    setRecording(false);
    setRecordSecs(0);
  }

  function clearAttach() {
    if (attach?.previewUrl) URL.revokeObjectURL(attach.previewUrl);
    setAttach(null);
    if (recording) stopRecording();
  }

  async function submit() {
    const value = text.trim();
    if (!value && !attach) return;
    const mediaFile = attach?.file ?? undefined;
    setText("");
    setAttach(null);
    onTyping(false);
    await onSend(value, replyTo?.id, mediaFile);
    onCancelReply();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function fmtSecs(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  const canSend = !!text.trim() || !!attach;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 flex items-center justify-between rounded-2xl glass-raised px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="text-primary">Replying to</p>
                <p className="truncate text-muted-foreground">{replyTo.content || "Message"}</p>
              </div>
              <button
                onClick={onCancelReply}
                className="ml-2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment preview */}
        <AnimatePresence>
          {attach && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 flex items-center gap-3 rounded-2xl glass-raised px-3 py-2"
            >
              {attach.previewUrl ? (
                <img
                  src={attach.previewUrl}
                  alt="attachment"
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  {attach.kind === "audio" ? (
                    <Mic size={18} className="text-primary" />
                  ) : (
                    <FileText size={18} className="text-primary" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{attach.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(attach.file.size / 1024).toFixed(0)} KB · {attach.kind}
                </p>
              </div>
              <button
                onClick={clearAttach}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording indicator */}
        <AnimatePresence>
          {recording && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-2 flex items-center gap-3 rounded-2xl glass-raised px-4 py-2.5"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-foreground">Recording</span>
              <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">
                {fmtSecs(recordSecs)}
              </span>
              <button
                onClick={stopRecording}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
              >
                <MicOff size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer bar */}
        <div className="glass-raised flex items-end gap-2 rounded-3xl px-2 py-1.5">
          {/* Attach file */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {/* Hidden inputs */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Textarea */}
          <textarea
            ref={taRef}
            value={text}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={recording ? "Recording voice message…" : "Message"}
            disabled={recording}
            className="max-h-[140px] flex-1 resize-none bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
          />

          {/* Send or mic */}
          {canSend ? (
            <button
              onClick={submit}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition active:scale-95"
              style={{ background: "var(--gradient-purple)", boxShadow: "var(--shadow-glow)" }}
            >
              <Send size={16} />
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onTouchStart={startRecording}
              aria-label="Record voice message"
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                recording
                  ? "bg-destructive text-white"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
