import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Plus, Radio, Music4, CalendarDays, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ChatListItem } from "@/components/messaging/ChatListItem";
import { useAuth } from "@/lib/auth-store";
import { useChats, usePresence } from "@/hooks/useMessaging";

export const Route = createFileRoute("/_authenticated/chats")({
  component: ChatsPage,
  ssr: false,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ChatsPage() {
  const { profile } = useAuth();
  const { data: chats = [], isLoading } = useChats();
  const presence = usePresence();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return chats;
    const n = q.toLowerCase();
    return chats.filter(
      (c) =>
        c.display.title.toLowerCase().includes(n) ||
        (c.last_message_preview ?? "").toLowerCase().includes(n),
    );
  }, [chats, q]);

  const unreadCount = chats.filter((c) => c.unread).length;
  const firstName = profile?.display_name?.split(" ")[0] ?? profile?.username ?? "Hey";

  return (
    <div className="flex min-h-screen flex-col pb-32 safe-top">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-12 pb-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.30em] text-muted-foreground">
              {greeting()}
            </p>
            <h1 className="mt-0.5 text-[32px] font-bold tracking-tight leading-tight">
              {firstName}
              <span className="text-gradient-primary">.</span>
            </h1>
            {unreadCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span
                  className="font-semibold"
                  style={{ color: "oklch(0.76 0.18 65)" }}
                >
                  {unreadCount} unread
                </span>{" "}
                {unreadCount === 1 ? "conversation" : "conversations"}
              </p>
            )}
          </div>

          <Link
            to="/new-chat"
            aria-label="New chat"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-[oklch(0.09_0.01_45)] transition active:scale-95"
          >
            <Plus size={22} strokeWidth={2.5} />
          </Link>
        </div>

        {/* Kente accent */}
        <div className="kente-strip mt-4 w-16" />
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mx-5 mb-4"
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 9%)" }}
        >
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats & people…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </motion.div>

      {/* Live Rooms strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-5 flex gap-3 overflow-x-auto scrollbar-none px-5"
      >
        <RoomChip icon={<Radio size={13} />} label="Match Night" sublabel="Live now" tone="red" />
        <RoomChip icon={<Music4 size={13} />} label="Hangout" sublabel="3 in room" tone="green" />
        <RoomChip icon={<CalendarDays size={13} />} label="Event Room" sublabel="Tomorrow" tone="amber" />
      </motion.div>

      {/* Section title */}
      {!q && (
        <div className="flex items-center justify-between px-5 mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Messages
          </p>
          {chats.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{chats.length} chat{chats.length !== 1 ? "s" : ""}</p>
          )}
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 px-3">
        {isLoading ? (
          <ChatSkeleton />
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

function RoomChip({
  icon, label, sublabel, tone,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  tone: "red" | "green" | "amber";
}) {
  const dotColor = tone === "red" ? "oklch(0.72 0.22 25)" : tone === "green" ? "oklch(0.72 0.20 145)" : "oklch(0.76 0.18 65)";
  const bg      = tone === "red" ? "oklch(0.72 0.22 25 / 0.12)" : tone === "green" ? "oklch(0.72 0.20 145 / 0.12)" : "oklch(0.76 0.18 65 / 0.12)";
  return (
    <button
      style={{ background: bg, border: `1px solid ${dotColor}33`, borderRadius: "1rem", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minHeight: 44, cursor: "pointer" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, animation: "breathe 4.5s ease-in-out infinite", flexShrink: 0 }} />
      <span style={{ color: "oklch(0.62 0.022 55)" }}>{icon}</span>
      <div style={{ textAlign: "left" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "inherit", lineHeight: 1 }}>{label}</p>
        <p style={{ fontSize: 10, color: "oklch(0.62 0.022 55)", marginTop: 1 }}>{sublabel}</p>
      </div>
    </button>
  );
}

function ChatSkeleton() {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-3">
          <div className="h-13 w-13 rounded-full bg-surface-raised animate-pulse shrink-0" style={{ width: 52, height: 52 }} />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-2/5 rounded-full bg-surface-raised animate-pulse" />
            <div className="h-3 w-3/5 rounded-full bg-surface-raised/70 animate-pulse" />
          </div>
          <div className="h-3 w-8 rounded-full bg-surface-raised/60 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasChats }: { hasChats: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-14 flex flex-col items-center justify-center text-center px-8"
    >
      <div
        className="relative mb-5 flex h-22 w-22 items-center justify-center rounded-3xl"
        style={{ width: 88, height: 88, background: "oklch(0.76 0.18 65 / 0.12)", borderRadius: "1.5rem" }}
      >
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, borderRadius: "1.5rem", background: "oklch(0.76 0.18 65 / 0.10)", filter: "blur(20px)", animation: "breathe 4.5s ease-in-out infinite" }}
        />
        <MessageCircle size={30} style={{ color: "oklch(0.76 0.18 65)", position: "relative" }} />
      </div>
      <h2 className="text-[18px] font-bold tracking-tight">
        {hasChats ? "Nothing found" : "Start your first chat"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {hasChats
          ? "Try a different name or number."
          : "Tap the\u00A0 + \u00A0button above to find someone and say hello."}
      </p>
      {!hasChats && (
        <Link
          to="/new-chat"
          className="mt-6 flex items-center gap-2 rounded-2xl px-6 font-semibold text-sm transition active:scale-95"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)", color: "oklch(0.09 0.01 45)", height: 48 }}
        >
          <Plus size={17} /> New chat
        </Link>
      )}
    </motion.div>
  );
}
