import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';
import { LoopRoomCard } from '@/components/LoopRoomCard';

const ROOMS = [
  {
    name: 'Sports Room',
    desc: 'Live match reactions, commentary & scores with your crew',
    iconName: 'radio' as const,
    status: 'available' as const,
    badge: 'V1',
    color: '#C84030',
  },
  {
    name: 'Hangout Room',
    desc: 'Persistent voice vibe — always on, drop in anytime',
    iconName: 'musical-notes' as const,
    status: 'available' as const,
    badge: 'V1',
    color: '#4CAF80',
  },
  {
    name: 'Event Room',
    desc: 'Plan together, countdown & go live on the day',
    iconName: 'calendar' as const,
    status: 'available' as const,
    badge: 'V1',
    color: '#D4A232',
  },
  {
    name: 'Music Room',
    desc: 'Listen in perfect sync — same beat, different places',
    iconName: 'headset' as const,
    status: 'soon' as const,
    badge: 'V1.5',
    color: '#8855CC',
  },
  {
    name: 'Watch Room',
    desc: 'Synced video sessions — movie night done right',
    iconName: 'tv' as const,
    status: 'soon' as const,
    badge: 'V1.5',
    color: '#4090C8',
  },
];

export default function LoopTab() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <View style={styles.loopIcon}>
            <View style={styles.loopInner} />
          </View>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Loop Rooms</Text>
          <KenteStrip style={styles.kente} height={3} />
          <Text style={styles.subtitle}>Group experiences, amplified together</Text>
        </View>
      </View>

      {/* Active rooms */}
      <Text style={styles.sectionLabel}>Active · V1</Text>
      {ROOMS.filter((r) => r.status !== 'soon').map((room) => (
        <LoopRoomCard key={room.name} {...room} />
      ))}

      {/* Coming soon */}
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Coming Soon</Text>
      {ROOMS.filter((r) => r.status === 'soon').map((room) => (
        <LoopRoomCard key={room.name} {...room} />
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  iconWrap: { flexShrink: 0 },
  loopIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1.5, borderColor: Colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  loopInner: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 3, borderColor: Colors.primary,
  },
  headerText: { flex: 1, gap: 6 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.3 },
  kente: { width: 40 },
  subtitle: { fontSize: 13, color: Colors.textSecondary },
  sectionLabel: {
    fontSize: 11.5, letterSpacing: 2, textTransform: 'uppercase',
    color: Colors.textMuted, fontFamily: 'Inter_600SemiBold', marginBottom: 12,
  },
});
