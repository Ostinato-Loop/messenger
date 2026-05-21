/**
 * Loop Messenger — messaging hooks
 * Centralised because Supabase Realtime channels need careful lifecycle
 * management and shared cache shapes between list + thread views.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { uploadAttachment } from "./useStorage";

// ---------- Types ----------
export type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type Chat = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  last_message_preview: string | null;
};

export type ChatWithMeta = Chat & {
  members: Profile[];
  last_read_at: string;
  pinned: boolean;
  archived: boolean;
  unread: boolean;
  display: { title: string; avatar: string | null };
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  type: "text" | "image" | "audio" | "video" | "file" | "system";
  media_url: string | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
  reactions?: { emoji: string; user_id: string }[];
  reads?: { user_id: string; read_at: string }[];
};

export type ReplyTarget = { id: string; content: string | null; sender_name: string };

// ---------- Chat list ----------
async function fetchChats(userId: string): Promise<ChatWithMeta[]> {
  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select("chat_id, last_read_at, pinned, archived, chats(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw error;

  const chatRows = (memberships ?? [])
    .map((m: any) => ({
      ...(m.chats as Chat),
      last_read_at: m.last_read_at,
      pinned: m.pinned,
      archived: m.archived,
    }))
    .filter(Boolean) as (Chat & { last_read_at: string; pinned: boolean; archived: boolean })[];

  if (chatRows.length === 0) return [];

  const chatIds = chatRows.map((c) => c.id);
  const { data: allMembers } = await supabase
    .from("chat_members")
    .select("chat_id, user_id, messenger_profiles!inner(user_id, username, display_name, avatar_url)")
    .in("chat_id", chatIds);

  const membersByChat = new Map<string, Profile[]>();
  for (const row of (allMembers ?? []) as any[]) {
    const arr = membersByChat.get(row.chat_id) ?? [];
    arr.push(row.messenger_profiles as Profile);
    membersByChat.set(row.chat_id, arr);
  }

  return chatRows
    .map((c) => {
      const members = membersByChat.get(c.id) ?? [];
      const others = members.filter((m) => m.user_id !== userId);
      const isDirect = c.type === "direct";
      const display = isDirect
        ? {
            title: others[0]?.display_name ?? others[0]?.username ?? "Unknown",
            avatar: others[0]?.avatar_url ?? null,
          }
        : { title: c.name ?? "Group", avatar: c.avatar_url };
      return {
        ...c,
        members,
        unread: new Date(c.last_message_at).getTime() > new Date(c.last_read_at).getTime(),
        display,
      };
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
}

export function useChats() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const query = useQuery({
    queryKey: ["chats", userId],
    queryFn: () => fetchChats(userId),
    enabled: !!userId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chats:user:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        qc.invalidateQueries({ queryKey: ["chats", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_members", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chats", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  return query;
}

// ---------- Messages (per chat) ----------
async function fetchMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*, message_reactions(emoji, user_id), message_reads(user_id, read_at)")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    reactions: m.message_reactions ?? [],
    reads: m.message_reads ?? [],
  }));
}

export function useMessages(chatId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["messages", chatId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchMessages(chatId!),
    enabled: !!chatId,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const incoming = payload.new as Message;
          qc.setQueryData<Message[]>(key, (curr) => {
            if (!curr) return [incoming];
            if (curr.some((m) => m.id === incoming.id)) return curr;
            const optimisticIdx = curr.findIndex(
              (m) => m.pending && m.sender_id === incoming.sender_id && m.content === incoming.content,
            );
            if (optimisticIdx >= 0) {
              const copy = curr.slice();
              copy[optimisticIdx] = { ...incoming, reactions: [], reads: [] };
              return copy;
            }
            return [...curr, { ...incoming, reactions: [], reads: [] }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as Message;
          qc.setQueryData<Message[]>(key, (curr) =>
            (curr ?? []).map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => { qc.invalidateQueries({ queryKey: key }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, qc]);

  // Mark last message as read
  useEffect(() => {
    if (!chatId || !user?.id) return;
    const messages = query.data;
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_id === user.id) return;
    void supabase
      .from("chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .eq("user_id", user.id);
    void supabase
      .from("message_reads")
      .upsert({ message_id: last.id, user_id: user.id }, { onConflict: "message_id,user_id" });
  }, [chatId, user?.id, query.data]);

  return query;
}

// ---------- Send text or media ----------
export function useSendMessage(chatId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useCallback(
    async (content: string, replyTo?: string, mediaFile?: File) => {
      if (!chatId || !user?.id) return;
      if (!content.trim() && !mediaFile) return;

      let media_url: string | null = null;
      let msgType: Message["type"] = "text";

      if (mediaFile) {
        try {
          const uploaded = await uploadAttachment(chatId, mediaFile);
          media_url = uploaded.publicUrl;
          msgType = uploaded.mediaType;
        } catch {
          return;
        }
      }

      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: Message = {
        id: tempId,
        chat_id: chatId,
        sender_id: user.id,
        content: content.trim() || null,
        type: msgType,
        media_url,
        reply_to: replyTo ?? null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        pending: true,
        reactions: [],
        reads: [],
      };
      qc.setQueryData<Message[]>(["messages", chatId], (curr) => [...(curr ?? []), optimistic]);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: content.trim() || null,
          type: msgType,
          media_url,
          reply_to: replyTo ?? null,
        })
        .select()
        .single();

      if (error) {
        qc.setQueryData<Message[]>(["messages", chatId], (curr) =>
          (curr ?? []).map((m) => (m.id === tempId ? { ...m, failed: true, pending: false } : m)),
        );
        return;
      }
      qc.setQueryData<Message[]>(["messages", chatId], (curr) =>
        (curr ?? []).map((m) =>
          m.id === tempId ? { ...(data as Message), reactions: [], reads: [] } : m,
        ),
      );
    },
    [chatId, qc, user?.id],
  );
}

// ---------- Reactions ----------
export function useToggleReaction() {
  const { user } = useAuth();
  return useCallback(
    async (messageId: string, emoji: string, existing: { emoji: string; user_id: string }[]) => {
      if (!user?.id) return;
      const mine = existing.some((r) => r.user_id === user.id && r.emoji === emoji);
      if (mine) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        await supabase
          .from("message_reactions")
          .insert({ message_id: messageId, user_id: user.id, emoji });
      }
    },
    [user?.id],
  );
}

// ---------- Typing ----------
export function useTyping(chatId: string | undefined) {
  const { user } = useAuth();
  const [othersTyping, setOthersTyping] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef<number>(0);

  useEffect(() => {
    if (!chatId || !user?.id) return;
    const channel = supabase.channel(`typing:${chatId}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { user_id, typing } = payload.payload as { user_id: string; typing: boolean };
        if (user_id === user.id) return;
        setOthersTyping((curr) => {
          if (typing) return curr.includes(user_id) ? curr : [...curr, user_id];
          return curr.filter((u) => u !== user_id);
        });
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOthersTyping([]);
    };
  }, [chatId, user?.id]);

  const sendTyping = useCallback((typing: boolean) => {
    const ch = channelRef.current;
    if (!ch || !user?.id) return;
    const now = Date.now();
    if (typing && now - lastSent.current < 1500) return;
    lastSent.current = now;
    void ch.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, typing },
    });
  }, [user?.id]);

  useEffect(() => {
    if (othersTyping.length === 0) return;
    const t = setTimeout(() => setOthersTyping([]), 4000);
    return () => clearTimeout(t);
  }, [othersTyping]);

  return { othersTyping, sendTyping };
}

// ---------- Presence ----------
export function usePresence() {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel("presence:loop", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return useMemo(() => ({
    isOnline: (id: string | undefined | null) => !!id && onlineIds.has(id),
    onlineIds,
  }), [onlineIds]);
}
