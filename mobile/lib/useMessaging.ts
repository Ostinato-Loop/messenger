/**
 * Loop Messenger — messaging hooks (React Native / Expo)
 * Adapted from the web useMessaging.ts with Supabase Realtime.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type Chat = {
  id: string;
  type: 'direct' | 'group';
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
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'system';
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

// ---------- Chat list ----------
export function useChats() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery<ChatWithMeta[]>({
    queryKey: ['chats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('chat_members')
        .select('chat_id, last_read_at, pinned, archived, chats(*)')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;

      const chatRows = (memberships ?? [])
        .map((m: any) => ({
          ...(m.chats as Chat),
          last_read_at: m.last_read_at,
          pinned: m.pinned,
          archived: m.archived,
        }))
        .filter(Boolean) as (Chat & { last_read_at: string; pinned: boolean; archived: boolean })[];

      const allChatIds = chatRows.map((c) => c.id);
      let membersMap: Record<string, Profile[]> = {};
      if (allChatIds.length) {
        const { data: memberRows } = await supabase
          .from('chat_members')
          .select('chat_id, messenger_profiles!inner(user_id, username, display_name, avatar_url)')
          .in('chat_id', allChatIds);
        (memberRows ?? []).forEach((r: any) => {
          (membersMap[r.chat_id] ??= []).push(r.messenger_profiles as Profile);
        });
      }

      return chatRows.map((c) => {
        const members = membersMap[c.id] ?? [];
        const others = members.filter((p) => p.user_id !== user!.id);
        const isDirect = c.type === 'direct';
        const lastMsgAt = c.last_message_at ?? c.last_read_at;
        const unread = !!c.last_read_at && !!lastMsgAt && new Date(lastMsgAt) > new Date(c.last_read_at);
        return {
          ...c,
          members,
          unread,
          display: isDirect
            ? {
                title: others[0]?.display_name ?? others[0]?.username ?? 'Unknown',
                avatar: others[0]?.avatar_url ?? null,
              }
            : { title: c.name ?? 'Group', avatar: c.avatar_url },
        };
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chats_list_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        qc.invalidateQueries({ queryKey: ['chats', user.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['chats', user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return query;
}

// ---------- Messages in a thread ----------
export function useMessages(chatId: string) {
  const qc = useQueryClient();

  const query = useQuery<Message[]>({
    queryKey: ['messages', chatId],
    enabled: !!chatId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, reactions:message_reactions(*), reads:message_reads(*)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`messages_${chatId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['messages', chatId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  return query;
}

// ---------- Send message ----------
export function useSendMessage(chatId: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useCallback(async (
    content: string,
    replyTo?: string,
    mediaUri?: string,
    mediaType?: Message['type'],
  ) => {
    if (!user) return;
    let media_url: string | null = null;
    let msgType: Message['type'] = 'text';

    if (mediaUri && mediaType) {
      media_url = mediaUri;
      msgType = mediaType;
    }

    const optimistic: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      chat_id: chatId,
      sender_id: user.id,
      content: content || null,
      type: msgType,
      media_url,
      reply_to: replyTo ?? null,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    qc.setQueryData<Message[]>(['messages', chatId], (old) => [optimistic, ...(old ?? [])]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content: content || null,
        type: msgType,
        media_url,
        reply_to: replyTo ?? null,
      })
      .select()
      .single();

    qc.setQueryData<Message[]>(['messages', chatId], (old) =>
      (old ?? []).map((m) => (m.id === optimistic.id ? { ...(data as Message), pending: false } : m)),
    );

    if (error) {
      qc.setQueryData<Message[]>(['messages', chatId], (old) =>
        (old ?? []).map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)),
      );
    }

    await supabase
      .from('chats')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content?.slice(0, 80) ?? (msgType === 'image' ? '📷 Photo' : '📎 File'),
      })
      .eq('id', chatId);

    qc.invalidateQueries({ queryKey: ['chats'] });
  }, [chatId, user]);
}

// ---------- Reactions ----------
export function useToggleReaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useCallback(async (messageId: string, emoji: string, existing: { emoji: string; user_id: string }[]) => {
    if (!user) return;
    const mine = existing.find((r) => r.user_id === user.id && r.emoji === emoji);
    if (mine) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user.id, emoji });
    }
    const chatId = qc.getQueryData<Message[]>(['messages'])?.find(m => m.id === messageId)?.chat_id;
    if (chatId) qc.invalidateQueries({ queryKey: ['messages', chatId] });
  }, [user]);
}

// ---------- Typing ----------
export function useTyping(chatId: string) {
  const { user } = useAuth();
  const [othersTyping, setOthersTyping] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!chatId || !user) return;
    const ch = supabase.channel(`typing_${chatId}_${user.id}`);
    channelRef.current = ch;
    ch
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id !== user.id) {
          setOthersTyping((prev) => {
            if (payload.typing) return [...new Set([...prev, payload.user_id])];
            return prev.filter((id) => id !== payload.user_id);
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, user?.id]);

  const sendTyping = useCallback((typing: boolean) => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user_id: user?.id, typing } });
  }, [user?.id]);

  return { othersTyping, sendTyping };
}

// ---------- Presence ----------
export function usePresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('global_presence');
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>();
        const ids = new Set(Object.values(state).flat().map((p) => p.user_id));
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return onlineUsers;
}

// ---------- Mark read ----------
export async function markChatRead(chatId: string, userId: string) {
  await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
