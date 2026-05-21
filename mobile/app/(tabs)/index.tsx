import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';
import { ChatListItem } from '@/components/ChatListItem';
import { useAuth } from '@/contexts/AuthContext';
import { useChats, usePresence } from '@/lib/useMessaging';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ChatsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { data: chats = [], isLoading, refetch } = useChats();
  const onlineUsers = usePresence();
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const firstName = profile?.display_name?.split(' ')[0] ?? profile?.username ?? 'Hey';
  const unreadCount = chats.filter((c) => c.unread).length;

  const filtered = useMemo(() => {
    if (!q.trim()) return chats;
    const n = q.toLowerCase();
    return chats.filter(
      (c) =>
        c.display.title.toLowerCase().includes(n) ||
        (c.last_message_preview ?? '').toLowerCase().includes(n),
    );
  }, [chats, q]);

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greetingLabel}>{greeting()}</Text>
            <Text style={styles.greetingName}>
              {firstName}<Text style={{ color: Colors.primary }}>.</Text>
            </Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadHint}>
                <Text style={{ color: Colors.primary, fontFamily: 'Inter_600SemiBold' }}>{unreadCount} unread</Text>
                {` ${unreadCount === 1 ? 'conversation' : 'conversations'}`}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/new-chat')}
            style={styles.newChatBtn}
          >
            <Ionicons name="add" size={22} color="#110D07" />
          </Pressable>
        </View>
        <KenteStrip style={styles.kente} height={3} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search conversations…"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          keyboardAppearance="dark"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Chat list */}
      {isLoading && !chats.length ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              isOnline={onlineUsers.has(
                item.members.find((m) => m.user_id !== profile?.user_id)?.user_id ?? '',
              )}
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          scrollEnabled={!!filtered.length}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>{q ? 'No results' : 'No chats yet'}</Text>
              <Text style={styles.emptyText}>
                {q ? 'Try a different search term' : 'Tap + to start a new conversation'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  greetingLabel: { fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: Colors.textMuted, fontFamily: 'Inter_500Medium' },
  greetingName: { fontSize: 30, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.5 },
  unreadHint: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  newChatBtn: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  kente: { marginTop: 4, width: 56 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  emptyText: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center' },
});
