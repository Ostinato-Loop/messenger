import React, { useRef, useState } from 'react';
import {
  Pressable, StyleSheet, Text, TextInput, View, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import type { Message } from '@/lib/useMessaging';

type Props = {
  onSend: (text: string, replyTo?: string, mediaUri?: string, mediaType?: Message['type']) => void;
  onTyping: (typing: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
};

export function ChatComposer({ onSend, onTyping, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState(1);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(val: string) {
    setText(val);
    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 2000);
    const newRows = Math.min(5, Math.max(1, val.split('\n').length));
    setRows(newRows);
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed, replyTo?.id);
    setText('');
    setRows(1);
    onTyping(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSend('', replyTo?.id, result.assets[0].uri, 'image');
    }
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSend(result.assets[0].name ?? 'File', replyTo?.id, result.assets[0].uri, 'file');
      }
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  }

  const canSend = text.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      {/* Reply banner */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyAccent} />
          <Text style={styles.replyText} numberOfLines={1}>
            {replyTo.content ?? '📎 Media'}
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={10}>
            <Ionicons name="close" size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        {/* Attach buttons */}
        <Pressable onPress={pickImage} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="image-outline" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Pressable onPress={pickFile} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="attach" size={22} color={Colors.textSecondary} />
        </Pressable>

        {/* Text input */}
        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, { height: Math.max(44, rows * 22 + 20) }]}
          multiline
          numberOfLines={rows}
          returnKeyType="default"
          keyboardAppearance="dark"
        />

        {/* Send */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        >
          <Ionicons name="arrow-up" size={20} color={canSend ? '#110D07' : Colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceRaised,
    gap: 10,
  },
  replyAccent: { width: 3, height: 28, borderRadius: 2, backgroundColor: Colors.primary },
  replyText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    color: Colors.text,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surfaceRaised,
  },
});
