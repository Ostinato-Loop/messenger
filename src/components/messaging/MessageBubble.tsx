import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft, Download, FileText, Smile } from "lucide-react";
import { useState } from "react";

import type { Message } from "@/hooks/useMessaging";

const QUICK_REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "🙏"];

type Props = {
  message: Message;
  isMine: boolean;
  showAvatar?: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  replyToMessage?: Message | null;
  onReply: (m: Message) => void;
  onReact: (messageId: string, emoji: string, existing: { emoji: string; user_id: string }[]) => void;
  currentUserId: string;
};

export function MessageBubble({
  message, isMine, showAvatar, senderName, senderAvatar,
  replyToMessage, onReply, onReact, currentUserId,
}: Props) {
  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [0, 60], [0, 1]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reactions = message.reactions ?? [];
  const grouped = reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.user_id);
    return acc;
  }, {});
  const isRead = (message.reads?.length ?? 0) > 0;
  const isDeleted = !!message.deleted_at;

  return (
    <div className={`group relative flex w-full items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine && (
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-surface-raised">
          {showAvatar && senderAvatar ? (
            <img src={senderAvatar} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 80 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 60) onReply(message);
        }}
        className="relative max-w-[78%]"
      >
        {/* Reply preview */}
        {replyToMessage && (
          <div className={`mb-1 rounded-xl px-3 py-1.5 text-xs ${isMine ? "ml-auto" : ""} glass border-l-2 border-primary/60 max-w-full`}>
            <p className="truncate text-muted-foreground">
              <span className="text-primary/90">↳ </span>
              {replyToMessage.content || "Attachment"}
            </p>
          </div>
        )}

        <motion.div
          layout
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onDoubleClick={() => !isDeleted && onReact(message.id, "❤️", reactions)}
          className={[
            "relative rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
            isMine
              ? "rounded-br-md text-primary-foreground"
              : "rounded-bl-md text-foreground glass",
            message.pending ? "opacity-70" : "",
            message.failed ? "ring-1 ring-destructive/60" : "",
            isDeleted ? "opacity-50 italic" : "",
          ].join(" ")}
          style={isMine && !isDeleted
            ? { background: "var(--gradient-purple)", boxShadow: "0 4px 24px -8px oklch(0.66 0.22 295 / 0.6)" }
            : undefined}
        >
          {!isMine && showAvatar && senderName && (
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-primary/80">
              {senderName}
            </p>
          )}

          {/* Content by type */}
          {isDeleted ? (
            <p className="text-sm">Message deleted</p>
          ) : message.type === "image" && message.media_url ? (
            <a href={message.media_url} target="_blank" rel="noopener noreferrer">
              <img
                src={message.media_url}
                alt="image"
                className="max-w-[220px] rounded-xl object-cover"
                loading="lazy"
              />
              {message.content && (
                <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </a>
          ) : message.type === "audio" && message.media_url ? (
            <div className="flex flex-col gap-1">
              <audio
                controls
                src={message.media_url}
                className="w-[200px] max-w-full rounded-lg"
                style={{ height: 36 }}
              />
              {message.content && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.content}</p>
              )}
            </div>
          ) : message.type === "file" && message.media_url ? (
            <a
              href={message.media_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-2 text-sm underline-offset-2 hover:underline"
            >
              <FileText size={16} className="shrink-0" />
              <span className="truncate max-w-[160px]">
                {message.content || message.media_url.split("/").pop() || "File"}
              </span>
              <Download size={14} className="shrink-0 opacity-70" />
            </a>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Timestamp + read receipt */}
          <div className={`mt-0.5 flex items-center gap-1 text-[10px] ${isMine ? "text-primary-foreground/80 justify-end" : "text-muted-foreground"}`}>
            <span>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {isMine && !message.pending && (
              isRead ? <CheckCheck size={12} /> : <Check size={12} />
            )}
            {message.pending && <span className="opacity-70">·sending</span>}
            {message.failed && <span className="text-destructive-foreground">failed</span>}
          </div>

          {/* Reactions row */}
          {Object.keys(grouped).length > 0 && (
            <div className={`absolute -bottom-3 ${isMine ? "right-2" : "left-2"} flex gap-1`}>
              {Object.entries(grouped).map(([emoji, users]) => {
                const mine = users.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    onClick={() => onReact(message.id, emoji, reactions)}
                    className={`flex items-center gap-0.5 rounded-full glass px-2 py-0.5 text-[11px] ${mine ? "glow-ring" : ""}`}
                  >
                    <span>{emoji}</span>
                    {users.length > 1 && <span className="text-muted-foreground">{users.length}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Swipe-to-reply indicator */}
        <motion.div
          style={{ opacity: replyIconOpacity }}
          className="pointer-events-none absolute -left-9 top-1/2 -translate-y-1/2"
        >
          <div className="rounded-full bg-primary p-1.5">
            <CornerUpLeft size={12} className="text-primary-foreground" />
          </div>
        </motion.div>

        {/* Hover action bar */}
        {!isDeleted && (
          <div className={`pointer-events-none absolute top-0 ${isMine ? "-left-16" : "-right-16"} flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100`}>
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-full glass-raised p-1.5 hover:glow-ring"
            >
              <Smile size={14} />
            </button>
            <button
              onClick={() => onReply(message)}
              className="rounded-full glass-raised p-1.5 hover:glow-ring"
            >
              <CornerUpLeft size={14} />
            </button>
          </div>
        )}

        {/* Quick reaction picker */}
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`absolute z-20 ${isMine ? "right-0" : "left-0"} -top-11 flex gap-1 rounded-full glass-raised px-2 py-1.5`}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => { onReact(message.id, e, reactions); setPickerOpen(false); }}
                className="text-xl transition-transform hover:scale-125"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {isMine && <div className="w-7 shrink-0" />}
    </div>
  );
}
