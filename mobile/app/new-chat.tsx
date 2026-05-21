import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { KenteStrip } from '@/components/KenteStrip';

type Person = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function NewChatPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('messenger_profiles')
      .select('user_id, username, display_name, avatar_url')
      .neq('user_id', user.id)
      .eq('onboarding_completed', true)
      .order('display_name', { ascending: true })
      .limit(100)
      .then(({ data }) => { setPeople((data ?? []) as Person[]); setLoading(false); });
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!q.trim()) return people;
    const n = q.toLowerCase();
    return people.filter(
      (p) => (p.display_name ?? '').toLowerCase().includes(n) || (p.username ?? '').toLowerCase().includes(n),
    );
  }, [people, q]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size > 1) setGroupMode(true);
      else if (next.size <= 1) setGroupMode(false);
      return next;
    });
  }

  async function handleCreate() {
    if (!user || selected.size === 0) return;
    setCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isGroup = selected.size > 1;
    const { data: chatRow, error } = await supabase
      .from('chats')
      .insert({
        type: isGroup ? 'group' : 'direct',
        name: isGroup ? (groupName.trim() || 'Group Chat') : null,
        created_by: user.id,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !chatRow) { setCreating(false); return; }

    const memberIds = [user.id, ...Array.from(selected)];
    await supabase.from('chat_members').insert(
      memberIds.map((uid) => ({
        chat_id: chatRow.id,
        user_id: uid,
        last_read_at: new Date().toISOString(),
      })),
    );

    setCreating(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/chat/${chatRow.id}` as any);
  }

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>New Message</Text>
        {selected.size > 0 && (
          <Pressable
            onPress={handleCreate}
            disabled={creating}
            style={styles.createBtn}
          >
            {creating
              ? <ActivityIndicator size="small" color="#110D07" />
              : <Text style={styles.createBtnText}>{selected.size > 1 ? 'Create Group' : 'Open Chat'}</Text>
            }
          </Pressable>
        )}
      </View>

      <KenteStrip height={2} />

      {/* Group name input */}
      {groupMode && (
        <View style={styles.groupNameRow}>
          <Ionicons name="people" size={18} color={Colors.primary} />
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name (optional)"
            placeholderTextColor={Colors.textMuted}
            style={styles.groupNameInput}
            keyboardAppearance="dark"
          />
        </View>
      )}

      {/* Selected chips */}
      {selected.size > 0 && (
        <View style={styles.chipRow}>
          {Array.from(selected).map((id) => {
            const p = people.find((x) => x.user_id === id);
            return (
              <Pressable key={id} onPress={() => toggle(id)} style={styles.chip}>
                <Text style={styles.chipText}>{p?.display_name ?? p?.username ?? id}</Text>
                <Ionicons name="close-circle" size={14} color={Colors.primary} />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search people…"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          keyboardAppearance="dark"
          autoFocus
        />
      </View>

      {/* People list */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.user_id}
          renderItem={({ item }) => {
            const sel = selected.has(item.user_id);
            return (
              <Pressable
                onPress={() => toggle(item.user_id)}
                style={({ pressed }) => [styles.personRow, pressed && styles.personRowPressed]}
              >
                <Avatar uri={item.avatar_url} name={item.display_name ?? item.username} size={44} />
                <View style={styles.personBody}>
                  <Text style={styles.personName}>{item.display_name ?? 'No name'}</Text>
                  <Text style={styles.personUsername}>@{item.username}</Text>
                </View>
                <View style={[styles.checkCircle, sel && styles.checkCircleSel]}>
                  {sel && <Ionicons name="checkmark" size={14} color="#110D07" />}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="person-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{q ? 'No results' : 'No users found'}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 6,
  },
  title: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: '#110D07' },
  groupNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  groupNameInput: { flex: 1, fontSize: 14.5, color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  chipText: { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_500Medium' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: Colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  personRowPressed: { backgroundColor: 'rgba(212,162,50,0.06)' },
  personBody: { flex: 1 },
  personName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text },
  personUsername: { fontSize: 12.5, color: Colors.textSecondary },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
