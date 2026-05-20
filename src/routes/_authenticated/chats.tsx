import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Plus, Search, Radio, Music4 } from "lucide-react";
import { useMemo, useState } from "react";

import { ChatListItem } from "@/components/messaging/ChatListItem";
import { useAuth } from "@/lib/auth-store";
import { useChats, usePresence } from "@/hooks/useMessaging";

export const Route = createFileRoute("/_authenticated/chats")({
  component: ChatsPage,
  ssr: false,
});

function ChatsPage() {
  const { profile } = useAuth();
  const { data: chats = [], isLoading } = useChats();
  const presence = usePresence();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return chats;
    const needle = q.toLowerCase();
    return chats.filter((c) =>
      c.display.title.toLowerCase().includes(needle) ||
      (c.last_message_preview ?? "").toLowerCase().includes(needle)
    );
  }, [chats, q]);

  return (
    <div className="flex min-h-screen flex-col px-5 pt-12 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex items-center justify-between"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {profile?.display_name?.split(" ")[0] ?? "Hello"}
            <span className="text-gradient-purple">.</span>
          </h1>
        </div>
        <Link
          to="/new-chat"
          className="flex h-11 w-11 items-center justify-center rounded-full glass-raised text-foreground/90 transition hover:glow-ring"
          aria-label="New chat"
        >
          <Plus size={20} />
        </Link>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass flex items-center gap-3 rounded-2xl px-4 py-3"
      >
        <Search size={16} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats, people, rooms"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mt-5 flex gap-3 overflow-x-auto scrollbar-none"
      >
        <RoomStatusChip icon={<Radio size={14} />} label="Match Night" tone="live" />
        <RoomStatusChip icon={<Music4 size={14} />} label="Hangout" tone="voice" />
        <RoomStatusChip icon={<Radio size={14} />} label="Event Soon" tone="event" />
      </motion.div>

      <div className="mt-4 flex-1">
        {isLoading ? (
          <ChatListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasChats={chats.length > 0} />
        ) : (
          <motion.ul layout className="flex flex-col">
            {filtered.map((c) => {
              const other = c.members.find((m) => m.user_id !== c.created_by) ?? c.members[0];
              return (
                <ChatListItem
                  key={c.id}
                  chat={c}
                  isOnline={presence.isOnline(other?.user_id)}
                />
              );
            })}
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function ChatListSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-12 w-12 rounded-full bg-surface-raised animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-surface-raised animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-surface-raised/70 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasChats }: { hasChats: boolean }) {
  return (
    <div className="mt-12 flex flex-col items-center justify-center text-center">
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl glass-raised">
        <div className="absolute inset-0 -z-10 rounded-3xl bg-primary/15 blur-2xl animate-breathe" />
        <MessageCircle size={28} style={{ color: "oklch(0.78 0.18 300)" }} />
      </div>
      <h2 className="text-lg font-medium">{hasChats ? "Nothing matches" : "Your conversations live here"}</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {hasChats ? "Try a different search." : "Tap + to start a new conversation."}
      </p>
    </div>
  );
}

function RoomStatusChip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "live" | "voice" | "event" }) {
  const dot =
    tone === "live" ? "bg-[oklch(0.72_0.2_25)]" :
    tone === "voice" ? "bg-[oklch(0.72_0.2_145)]" :
    "bg-[oklch(0.7_0.18_85)]";
  return (
    <div className="glass flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot} animate-pulse`} />
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-foreground/90">{label}</span>
    </div>
  );
}
