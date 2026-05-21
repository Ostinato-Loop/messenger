import React, { useState } from 'react';
import {
  Image, Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { Message } from '@/lib/useMessaging';

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '🙏'];

type Props = {
  message: Message;
  isMine: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  replyToMessage?: Message | null;
  showAvatar?: boolean;
  onReply: (m: Message) => void;
  onReact: (messageId: string, emoji: string, existing: { emoji: string; user_id: string }[]) => void;
  currentUserId: string;
};

export function MessageBubble({
  message, isMine, senderName, senderAvatar, replyToMessage,
  showAvatar, onReply, onReact, currentUserId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactions = message.reactions ?? [];
  const grouped = reactions.reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.user_id);
    return acc;
  }, {});
  const isDeleted = !!message.deleted_at;
  const isRead = (message.reads?.length ?? 0) > 0;

  const bubbleBg = isMine
    ? Colors.primary
    : Colors.surfaceRaised;
  const textColor = isMine ? '#110D07' : Colors.text;

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      {!isMine && (
        <View style={styles.avatarSlot}>
          {showAvatar && senderAvatar ? (
            <Image source={{ uri: senderAvatar }} style={styles.avatar} />
          ) : <View style={styles.avatarEmpty} />}
        </View>
      )}

      <View style={styles.bubbleWrap}>
        {/* Reply preview */}
        {replyToMessage && !isDeleted && (
          <View style={[styles.replyBar, { borderLeftColor: isMine ? '#110D07' : Colors.primary }]}>
            <Text style={[styles.replyText, { color: isMine ? 'rgba(0,0,0,0.55)' : Colors.textSecondary }]} numberOfLines={1}>
              {replyToMessage.content ?? '📎 Media'}
            </Text>
          </View>
        )}

        <Pressable
          onLongPress={() => setPickerOpen(true)}
          style={[styles.bubble, { backgroundColor: bubbleBg }]}
        >
          {!isMine && senderName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}

          {isDeleted ? (
            <Text style={[styles.deletedText, { color: isMine ? 'rgba(0,0,0,0.45)' : Colors.textMuted }]}>
              Message deleted
            </Text>
          ) : message.type === 'image' && message.media_url ? (
            <Pressable onPress={() => Linking.openURL(message.media_url!)}>
              <Image source={{ uri: message.media_url }} style={styles.image} resizeMode="cover" />
              {message.content ? <Text style={[styles.text, { color: textColor, marginTop: 4 }]}>{message.content}</Text> : null}
            </Pressable>
          ) : message.type === 'audio' && message.media_url ? (
            <View style={styles.audioRow}>
              <Ionicons name="mic" size={18} color={textColor} />
              <Text style={[styles.text, { color: textColor, marginLeft: 6 }]}>Voice message</Text>
            </View>
          ) : message.type === 'file' && message.media_url ? (
            <Pressable onPress={() => Linking.openURL(message.media_url!)} style={styles.fileRow}>
              <Ionicons name="document-attach" size={20} color={textColor} />
              <Text style={[styles.text, { color: textColor, marginLeft: 6, flex: 1 }]} numberOfLines={1}>
                {message.content ?? 'File'}
              </Text>
              <Ionicons name="download-outline" size={16} color={textColor} style={{ marginLeft: 4 }} />
            </Pressable>
          ) : (
            <Text style={[styles.text, { color: textColor }]}>{message.content}</Text>
          )}

          {/* Timestamp + read */}
          <View style={[styles.metaRow, isMine ? styles.metaRowMine : styles.metaRowOther]}>
            <Text style={[styles.time, { color: isMine ? 'rgba(17,13,7,0.55)' : Colors.textMuted }]}>
              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMine && (
              <Ionicons
                name={isRead ? 'checkmark-done' : 'checkmark'}
                size={13}
                color={isRead ? '#2ECC71' : 'rgba(17,13,7,0.45)'}
                style={{ marginLeft: 3 }}
              />
            )}
            {message.pending && <Ionicons name="time-outline" size={12} color="rgba(17,13,7,0.4)" style={{ marginLeft: 2 }} />}
          </View>
        </Pressable>

        {/* Reply button on press */}
        <Pressable onPress={() => onReply(message)} style={[styles.replyBtn, isMine ? { left: -28 } : { right: -28 }]}>
          <Ionicons name="arrow-undo" size={14} color={Colors.textMuted} />
        </Pressable>

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <View style={[styles.reactionsRow, isMine ? styles.reactionsRight : styles.reactionsLeft]}>
            {Object.entries(grouped).map(([emoji, users]) => (
              <Pressable
                key={emoji}
                onPress={() => onReact(message.id, emoji, reactions)}
                style={[styles.reactionChip, users.includes(currentUserId) && styles.reactionChipMine]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && <Text style={styles.reactionCount}>{users.length}</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Reaction picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
          <View style={styles.pickerBox}>
            <View style={styles.pickerRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => { onReact(message.id, emoji, reactions); setPickerOpen(false); }}
                  style={styles.pickerEmoji}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pickerActions}>
              <TouchableOpacity onPress={() => { onReply(message); setPickerOpen(false); }} style={styles.pickerAction}>
                <Ionicons name="arrow-undo" size={18} color={Colors.textSecondary} />
                <Text style={styles.pickerActionText}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, marginBottom: 4 },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 28, marginRight: 6 },
  avatarEmpty: { width: 28, height: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  bubbleWrap: { maxWidth: '78%', position: 'relative' },
  replyBar: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 3,
    marginBottom: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  },
  replyText: { fontSize: 11.5 },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  senderName: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  text: { fontSize: 14.5, lineHeight: 20 },
  deletedText: { fontSize: 13, fontStyle: 'italic' },
  image: { width: 200, height: 160, borderRadius: 10 },
  audioRow: { flexDirection: 'row', alignItems: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center' },
  metaRow: { position: 'absolute', bottom: 5, flexDirection: 'row', alignItems: 'center' },
  metaRowMine: { right: 10 },
  metaRowOther: { right: 10 },
  time: { fontSize: 10 },
  replyBtn: {
    position: 'absolute',
    bottom: 6,
    padding: 4,
    opacity: 0.6,
  },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  reactionsRight: { justifyContent: 'flex-end' },
  reactionsLeft: { justifyContent: 'flex-start' },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionChipMine: { borderColor: Colors.primary },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: Colors.textSecondary, marginLeft: 2 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    width: 300,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pickerEmoji: { padding: 6 },
  pickerActions: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  pickerAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pickerActionText: { fontSize: 14, color: Colors.textSecondary },
});
