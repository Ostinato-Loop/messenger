import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
};

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function bgFromName(name?: string | null): string {
  const colors = ['#8855CC', '#4090C8', '#30A89A', '#D4A232', '#C84030'];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function Avatar({ uri, name, size = 44, online }: Props) {
  const dotSize = Math.max(10, size * 0.22);
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View style={[styles.placeholder, {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bgFromName(name),
        }]}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
        </View>
      )}
      {online !== undefined && (
        <View style={[styles.dot, {
          width: dotSize, height: dotSize, borderRadius: dotSize / 2,
          backgroundColor: online ? Colors.online : Colors.offline,
          bottom: 0, right: 0,
        }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
