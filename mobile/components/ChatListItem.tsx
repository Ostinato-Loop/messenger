import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { Avatar } from './Avatar';
import type { ChatWithMeta } from '@/lib/useMessaging';
import { timeAgo } from '@/lib/useMessaging';

type Props = {
  chat: ChatWithMeta;
  isOnline?: boolean;
  isTyping?: boolean;
  onPress: () => void;
};

export function ChatListItem({ chat, isOnline, isTyping, onPress }: Props) {
  const { display, unread, pinned, last_message_preview, last_message_at } = chat;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      android_ripple={{ color: 'rgba(212,162,50,0.08)' }}
    >
      <Avatar uri={display.avatar} name={display.title} size={50} online={isOnline} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
            {display.title}
            {pinned && <Text style={styles.pin}> ·</Text>}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {last_message_at ? timeAgo(last_message_at) : ''}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          {isTyping ? (
            <View style={styles.typingRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.typingDot, { opacity: 0.4 + i * 0.2 }]} />
              ))}
            </View>
          ) : (
            <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
              {last_message_preview ?? 'No messages yet'}
            </Text>
          )}
          {unread && <View style={styles.unreadBadge} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowPressed: { backgroundColor: 'rgba(212,162,50,0.06)' },
  body: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '500', color: Colors.text, flex: 1, marginRight: 8 },
  titleUnread: { fontWeight: '700', color: Colors.text },
  time: { fontSize: 12, color: Colors.textMuted },
  timeUnread: { color: Colors.primary },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  previewUnread: { color: Colors.textSecondary, fontWeight: '500' },
  pin: { color: Colors.primary },
  typingRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  typingDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  unreadBadge: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: 8,
  },
});
