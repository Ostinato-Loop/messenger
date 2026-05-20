import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Pin, User as UserIcon } from "lucide-react";

import type { ChatWithMeta } from "@/hooks/useMessaging";
import { TypingDots } from "./TypingDots";

type Props = {
  chat: ChatWithMeta;
  isOnline?: boolean;
  isTyping?: boolean;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatListItem({ chat, isOnline, isTyping }: Props) {
  const { display, unread, pinned, last_message_preview, last_message_at } = chat;
  return (
    <Link
      to="/chat/$chatId"
      params={{ chatId: chat.id }}
      className="group relative block"
    >
      <motion.div
        whileTap={{ scale: 0.985 }}
        className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-accent/30"
      >
        <div className="relative">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-surface-raised">
            {display.avatar ? (
              <img src={display.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <UserIcon size={20} />
              </div>
            )}
          </div>
          {isOnline && chat.type === "direct" && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-[oklch(0.72_0.2_145)]" />
          )}
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse-glow" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[15px] font-medium text-foreground">
              {display.title}
            </h3>
            <span className={`shrink-0 text-[11px] ${unread ? "text-primary" : "text-muted-foreground"}`}>
              {timeAgo(last_message_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {isTyping ? (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <TypingDots small />
                typing
              </span>
            ) : (
              <p className={`truncate text-xs ${unread ? "text-foreground/90 font-medium" : "text-muted-foreground"}`}>
                {last_message_preview || "Say hi 👋"}
              </p>
            )}
            {pinned && <Pin size={11} className="shrink-0 text-muted-foreground" />}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
