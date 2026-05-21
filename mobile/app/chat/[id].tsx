import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTRTC } from '@/lib/useTRTC';
import {
  useMessages, useSendMessage, useToggleReaction, useTyping, usePresence, markChatRead,
  type ChatWithMeta, type Message, type Profile,
} from '@/lib/useMessaging';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatComposer } from '@/components/ChatComposer';
import { Avatar } from '@/components/Avatar';
import { Colors } from '@/constants/colors';

export default function ChatThread() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { callState, start, end } = useTRTC();

  const [chat, setChat] = useState<ChatWithMeta | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const { data: messages = [], isLoading } = useMessages(chatId);
  const send = useSendMessage(chatId);
  const toggleReaction = useToggleReaction();
  const { othersTyping, sendTyping } = useTyping(chatId);
  const onlineUsers = usePresence();

  // Load chat meta
  useEffect(() => {
    if (!chatId || !user) return;
    let cancelled = false;
    (async () => {
      const [{ data: chatRow }, { data: memberRows }] = await Promise.all([
        supabase.from('chats').select('*').eq('id', chatId).maybeSingle(),
        supabase
          .from('chat_members')
          .select('user_id, messenger_profiles!inner(user_id, username, display_name, avatar_url)')
          .eq('chat_id', chatId),
      ]);
      if (cancelled) return;
      const m = (memberRows ?? []).map((r: any) => r.messenger_profiles as Profile);
      setMembers(m);
      if (chatRow) {
        const others = m.filter((p) => p.user_id !== user.id);
        const isDirect = chatRow.type === 'direct';
        setChat({
          ...(chatRow as any),
          members: m,
          last_read_at: new Date().toISOString(),
          pinned: false, archived: false, unread: false,
          display: isDirect
            ? { title: others[0]?.display_name ?? others[0]?.username ?? 'Unknown', avatar: others[0]?.avatar_url ?? null }
            : { title: chatRow.name ?? 'Group', avatar: chatRow.avatar_url },
        });
      }
      // Mark read
      markChatRead(chatId, user.id).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [chatId, user?.id]);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    members.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [members]);

  const otherDirect = chat?.type === 'direct'
    ? members.find((m) => m.user_id !== user?.id)
    : null;
  const isOtherOnline = otherDirect ? onlineUsers.has(otherDirect.user_id) : false;

  const replyMap = useMemo(() => {
    const m = new Map<string, Message>();
    messages.forEach((msg) => m.set(msg.id, msg));
    return m;
  }, [messages]);

  async function handleSend(text: string, replyToId?: string, mediaUri?: string, mediaType?: Message['type']) {
    await send(text, replyToId, mediaUri, mediaType);
    setReplyTo(null);
  }

  async function startCall(mode: 'voice' | 'video') {
    if (!user || !chatId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await start({ roomId: `chat_${chatId}`, userId: user.id, mode });
  }

  const isTypingText = othersTyping.length > 0
    ? `${othersTyping.map((id) => profilesById.get(id)?.display_name ?? 'Someone').join(', ')} typing…`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>

        <Avatar
          uri={chat?.display.avatar}
          name={chat?.display.title}
          size={36}
          online={isOtherOnline}
        />

        <View style={styles.headerBody}>
          <Text style={styles.headerTitle} numberOfLines={1}>{chat?.display.title ?? '…'}</Text>
          <Text style={styles.headerStatus}>
            {isTypingText ?? (isOtherOnline ? 'Online now' : 'Loop Messenger')}
          </Text>
        </View>

        {/* Call buttons */}
        <View style={styles.callBtns}>
          <Pressable onPress={() => startCall('voice')} style={styles.callBtn}>
            <Ionicons name="call" size={20} color={callState.active ? Colors.success : Colors.text} />
          </Pressable>
          <Pressable onPress={() => startCall('video')} style={styles.callBtn}>
            <Ionicons name="videocam" size={20} color={callState.active ? Colors.success : Colors.text} />
          </Pressable>
          {callState.active && (
            <Pressable onPress={end} style={[styles.callBtn, styles.callBtnHangup]}>
              <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {/* Messages */}
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            inverted
            renderItem={({ item, index }) => {
              const isMine = item.sender_id === user?.id;
              const sender = profilesById.get(item.sender_id);
              const prevMsg = messages[index + 1];
              const showAvatar = !isMine && (!prevMsg || prevMsg.sender_id !== item.sender_id);
              return (
                <MessageBubble
                  message={item}
                  isMine={isMine}
                  showAvatar={showAvatar}
                  senderName={!isMine ? (sender?.display_name ?? sender?.username ?? undefined) : undefined}
                  senderAvatar={!isMine ? (sender?.avatar_url ?? undefined) : undefined}
                  replyToMessage={item.reply_to ? (replyMap.get(item.reply_to) ?? null) : null}
                  onReply={setReplyTo}
                  onReact={(msgId, emoji, existing) => toggleReaction(msgId, emoji, existing)}
                  currentUserId={user?.id ?? ''}
                />
              );
            }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 12 }}
            ListHeaderComponent={
              isTypingText ? (
                <View style={styles.typingBanner}>
                  <Text style={styles.typingText}>{isTypingText}</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyMsg}>
                <Text style={styles.emptyMsgText}>No messages yet. Say hello!</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Composer */}
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatComposer
            onSend={handleSend}
            onTyping={sendTyping}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerBody: { flex: 1 },
  headerTitle: { fontSize: 15.5, fontFamily: 'Inter_700Bold', color: Colors.text },
  headerStatus: { fontSize: 11.5, color: Colors.textMuted, marginTop: 1 },
  callBtns: { flexDirection: 'row', gap: 4 },
  callBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  callBtnHangup: { backgroundColor: Colors.error, borderColor: Colors.error },
  typingBanner: {
    alignSelf: 'flex-start', marginLeft: 42, marginBottom: 4,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  typingText: { fontSize: 12.5, color: Colors.textSecondary, fontStyle: 'italic' },
  emptyMsg: { alignItems: 'center', paddingTop: 60 },
  emptyMsgText: { fontSize: 14, color: Colors.textMuted },
});
