import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = { style?: ViewStyle; height?: number };

export function KenteStrip({ style, height = 3 }: Props) {
  return (
    <View style={[styles.strip, { height }, style]}>
      {Colors.kente.map((color, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
