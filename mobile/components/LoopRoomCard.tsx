import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';

type RoomStatus = 'available' | 'live' | 'soon';

type Props = {
  name: string;
  desc: string;
  iconName: keyof typeof Ionicons.glyphMap;
  status: RoomStatus;
  badge: string;
  color: string;
  onPress?: () => void;
};

export function LoopRoomCard({ name, desc, iconName, status, badge, color, onPress }: Props) {
  const isSoon = status === 'soon';
  const isLive = status === 'live';

  function handlePress() {
    if (isSoon) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: color, opacity: isSoon ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={iconName} size={22} color={color} />
        {isLive && <View style={styles.liveDot} />}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{name}</Text>
          <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <Text style={[styles.badgeText, { color }]}>{badge}</Text>
          </View>
          {isLive && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {isSoon && (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>SOON</Text>
            </View>
          )}
        </View>
        <Text style={styles.desc} numberOfLines={2}>{desc}</Text>
      </View>

      {/* Arrow */}
      {!isSoon && (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  liveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  liveBadge: {
    backgroundColor: Colors.success + '22',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.success + '55',
  },
  liveBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  soonBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soonBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
