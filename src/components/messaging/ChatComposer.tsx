import { motion, AnimatePresence } from "framer-motion";
import { Mic, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Message } from "@/hooks/useMessaging";

type Props = {
  onSend: (text: string, replyTo?: string) => void | Promise<void>;
  onTyping: (typing: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
};

export function ChatComposer({ onSend, onTyping, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [text]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTyping(false), 2000);
  }

  async function submit() {
    const value = text.trim();
    if (!value) return;
    setText("");
    onTyping(false);
    await onSend(value, replyTo?.id);
    onCancelReply();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 safe-bottom pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
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
              <button onClick={onCancelReply} className="ml-2 rounded-full p-1 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-raised flex items-end gap-2 rounded-3xl px-2 py-1.5">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground" aria-label="Attach">
            <Paperclip size={18} />
          </button>
          <textarea
            ref={taRef}
            value={text}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Message"
            className="max-h-[140px] flex-1 resize-none bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          {text.trim() ? (
            <button
              onClick={submit}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition active:scale-95"
              style={{ background: "var(--gradient-purple)", boxShadow: "var(--shadow-glow)" }}
            >
              <Send size={16} />
            </button>
          ) : (
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground" aria-label="Voice">
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
