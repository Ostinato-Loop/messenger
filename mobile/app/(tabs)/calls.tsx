import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTRTC } from '@/lib/useTRTC';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';
import { Avatar } from '@/components/Avatar';

type RecentCall = {
  id: string;
  chat_id: string;
  caller_id: string;
  type: 'voice' | 'video';
  started_at: string;
  ended_at: string | null;
};

function formatDuration(started: string, ended: string | null): string {
  if (!ended) return 'Ongoing';
  const secs = Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 86400) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 172800) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CallsTab() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { callState, start, end, toggleAudio, toggleVideo } = useTRTC();
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState<{ peerName: string; mode: 'voice' | 'video' } | null>(null);
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('calls')
      .select('*')
      .eq('caller_id', user.id)
      .order('started_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setRecent((data as RecentCall[]) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  async function initiateCall(chatId: string, peerName: string, mode: 'voice' | 'video') {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setActiveCall({ peerName, mode });
    const roomId = `chat_${chatId}`;
    await start({ roomId, userId: user.id, mode });
    await supabase.from('calls').insert({
      chat_id: chatId, caller_id: user.id, type: mode,
      started_at: new Date().toISOString(),
    }).catch(() => {});
  }

  async function hangUp() {
    await end();
    setActiveCall(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calls</Text>
        <KenteStrip style={styles.kente} height={3} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : recent.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="call-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No recent calls</Text>
          <Text style={styles.emptyText}>Start a call from any chat conversation</Text>
        </View>
      ) : (
        <FlatList
          data={recent}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <View style={styles.callRow}>
              <View style={styles.callIconWrap}>
                <Ionicons
                  name={item.type === 'video' ? 'videocam' : 'call'}
                  size={20}
                  color={item.caller_id === user?.id ? Colors.primary : Colors.success}
                />
              </View>
              <View style={styles.callBody}>
                <Text style={styles.callTitle}>
                  {item.type === 'video' ? 'Video call' : 'Voice call'}
                </Text>
                <Text style={styles.callMeta}>
                  {formatDuration(item.started_at, item.ended_at)} · {timeLabel(item.started_at)}
                </Text>
              </View>
              <Pressable
                onPress={() => initiateCall(item.chat_id, 'Contact', item.type)}
                style={styles.callbackBtn}
              >
                <Ionicons name="call" size={18} color={Colors.primary} />
              </Pressable>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Active call overlay */}
      <Modal visible={callState.active} transparent animationType="slide" onRequestClose={hangUp}>
        <View style={styles.callOverlay}>
          <View style={styles.callPanel}>
            <View style={styles.callAvatarWrap}>
              <Avatar name={activeCall?.peerName} size={80} />
            </View>
            <Text style={styles.callPeerName}>{activeCall?.peerName ?? 'Calling…'}</Text>
            <Text style={styles.callStatus}>
              {callState.connecting ? 'Connecting…' : `${activeCall?.mode === 'video' ? 'Video' : 'Voice'} call`}
            </Text>

            {/* Controls */}
            <View style={styles.callControls}>
              <Pressable onPress={toggleAudio} style={[styles.callCtrlBtn, callState.audioMuted && styles.ctrlBtnActive]}>
                <Ionicons name={callState.audioMuted ? 'mic-off' : 'mic'} size={24} color={Colors.text} />
              </Pressable>
              {activeCall?.mode === 'video' && (
                <Pressable onPress={toggleVideo} style={[styles.callCtrlBtn, callState.videoMuted && styles.ctrlBtnActive]}>
                  <Ionicons name={callState.videoMuted ? 'videocam-off' : 'videocam'} size={24} color={Colors.text} />
                </Pressable>
              )}
              <Pressable onPress={hangUp} style={styles.hangupBtn}>
                <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12, gap: 8 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.5 },
  kente: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptyText: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  callRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  callIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  callBody: { flex: 1 },
  callTitle: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  callMeta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },
  callbackBtn: { padding: 10 },
  callOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  callPanel: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 32, alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  callAvatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primaryDim,
    borderWidth: 2.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  callPeerName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text },
  callStatus: { fontSize: 14, color: Colors.textSecondary },
  callControls: { flexDirection: 'row', gap: 20, marginTop: 24 },
  callCtrlBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  ctrlBtnActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  hangupBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
});
