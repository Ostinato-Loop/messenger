import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Search, User as UserIcon, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/new-chat")({
  component: NewChatPage,
  ssr: false,
});

type Person = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function NewChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("messenger_profiles")
        .select("user_id, username, display_name, avatar_url")
        .neq("user_id", user.id)
        .eq("onboarding_completed", true)
        .order("display_name", { ascending: true })
        .limit(100);
      setPeople((data ?? []) as Person[]);
      setLoading(false);
    })();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!q.trim()) return people;
    const n = q.toLowerCase();
    return people.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(n) ||
        (p.username ?? "").toLowerCase().includes(n),
    );
  }, [people, q]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size > 1) setGroupMode(true);
      return next;
    });
  }

  async function startDirect(otherId: string) {
    if (!user?.id) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("get_or_create_direct_chat", { _other: otherId });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/chat/$chatId", params: { chatId: data as string } });
  }

  async function createGroup() {
    if (!user?.id || selected.size < 2) return;
    if (!groupName.trim()) { toast.error("Name your group"); return; }
    setCreating(true);
    const { data: chat, error } = await supabase
      .from("chats")
      .insert({ type: "group", name: groupName.trim(), created_by: user.id })
      .select()
      .single();
    if (error || !chat) { toast.error(error?.message ?? "Failed"); setCreating(false); return; }

    const members = [
      { chat_id: chat.id, user_id: user.id, role: "owner" as const },
      ...Array.from(selected).map((uid) => ({ chat_id: chat.id, user_id: uid, role: "member" as const })),
    ];
    const { error: mErr } = await supabase.from("chat_members").insert(members);
    setCreating(false);
    if (mErr) { toast.error(mErr.message); return; }
    navigate({ to: "/chat/$chatId", params: { chatId: chat.id } });
  }

  return (
    <div className="relative flex min-h-screen flex-col px-4 pt-4 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <button
          onClick={() => navigate({ to: "/chats" })}
          className="rounded-full p-2 text-foreground/90 transition hover:bg-accent/30"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">New</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {groupMode ? "Create group" : "Start a chat"}
          </h1>
        </div>
        <button
          onClick={() => { setGroupMode((v) => !v); }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition ${groupMode ? "glow-ring text-primary-foreground" : "glass text-muted-foreground"}`}
          style={groupMode ? { background: "var(--gradient-purple)" } : undefined}
        >
          <Users size={14} /> Group
        </button>
      </motion.header>

      {groupMode && (
        <motion.input
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          className="mt-4 rounded-2xl glass-raised px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-within:glow-ring"
        />
      )}

      <div className="mt-4 flex items-center gap-3 rounded-2xl glass px-4 py-3">
        <Search size={16} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="mt-3 flex-1 overflow-y-auto">
        {loading ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No one yet — invite friends to Loop.
          </p>
        ) : (
          filtered.map((p) => {
            const isSelected = selected.has(p.user_id);
            return (
              <button
                key={p.user_id}
                onClick={() => groupMode ? toggle(p.user_id) : startDirect(p.user_id)}
                disabled={creating}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-accent/30"
              >
                <div className="h-11 w-11 overflow-hidden rounded-full bg-surface-raised">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <UserIcon size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{p.display_name ?? p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                </div>
                {groupMode && (
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${isSelected ? "border-primary glow-ring" : "border-border"}`}
                       style={isSelected ? { background: "var(--gradient-purple)" } : undefined}>
                    {isSelected && <Check size={14} className="text-primary-foreground" />}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {groupMode && selected.size >= 2 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30"
        >
          <button
            onClick={createGroup}
            disabled={creating}
            className="rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-purple)", boxShadow: "var(--shadow-glow)" }}
          >
            Create group · {selected.size} people
          </button>
        </motion.div>
      )}
    </div>
  );
}
