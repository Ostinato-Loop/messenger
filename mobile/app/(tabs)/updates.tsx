import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { KenteStrip } from '@/components/KenteStrip';

export default function UpdatesTab() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Updates</Text>
        <KenteStrip style={styles.kente} height={3} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={36} color={Colors.primary} />
        </View>
        <Text style={styles.headline}>Coming soon</Text>
        <Text style={styles.sub}>
          Status updates, stories, and ambient signals from your circle.{'\n'}Ephemeral moments, amplified.
        </Text>
        <View style={styles.pillRow}>
          {['Status', 'Stories', 'Reactions', 'Clips'].map((pill) => (
            <View key={pill} style={styles.pill}>
              <Text style={styles.pillText}>{pill}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12, gap: 8 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', color: Colors.text, letterSpacing: -0.5 },
  kente: { width: 40 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40, paddingBottom: 80 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1.5, borderColor: Colors.primaryBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  headline: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  pillText: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'Inter_500Medium' },
});
