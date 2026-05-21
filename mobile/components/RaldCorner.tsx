/**
 * RALD auth box — 4-corner animated state indicators
 * idle → amber (typing) → red (error) → green (success)
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/colors';

export type BoxState = 'idle' | 'typing' | 'error' | 'success';

const STATE_COLOR: Record<BoxState, string> = {
  idle:    Colors.cornerIdle,
  typing:  Colors.cornerTyping,
  error:   Colors.cornerError,
  success: Colors.cornerSuccess,
};

const STATE_GLOW: Record<BoxState, string> = {
  idle:    'transparent',
  typing:  'rgba(212,162,50,0.22)',
  error:   'rgba(200,64,48,0.22)',
  success: 'rgba(76,175,128,0.22)',
};

const CORNER_SIZE = 22;
const BORDER_W = 2.5;
const RADIUS = 12;

type CornerProps = {
  pos: 'tl' | 'tr' | 'bl' | 'br';
  color: Animated.AnimatedInterpolation<string>;
};

function Corner({ pos, color }: CornerProps) {
  const base: Record<string, number | string> = { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE };
  const borderProps: Record<string, number | string | undefined> = {};

  if (pos === 'tl') {
    Object.assign(base, { top: 0, left: 0 });
    Object.assign(borderProps, { borderTopWidth: BORDER_W, borderLeftWidth: BORDER_W, borderTopLeftRadius: RADIUS });
  } else if (pos === 'tr') {
    Object.assign(base, { top: 0, right: 0 });
    Object.assign(borderProps, { borderTopWidth: BORDER_W, borderRightWidth: BORDER_W, borderTopRightRadius: RADIUS });
  } else if (pos === 'bl') {
    Object.assign(base, { bottom: 0, left: 0 });
    Object.assign(borderProps, { borderBottomWidth: BORDER_W, borderLeftWidth: BORDER_W, borderBottomLeftRadius: RADIUS });
  } else {
    Object.assign(base, { bottom: 0, right: 0 });
    Object.assign(borderProps, { borderBottomWidth: BORDER_W, borderRightWidth: BORDER_W, borderBottomRightRadius: RADIUS });
  }

  return (
    <Animated.View
      style={[
        base as any,
        borderProps as any,
        { borderColor: color },
      ]}
    />
  );
}

type Props = {
  state: BoxState;
  children: React.ReactNode;
  style?: object;
};

export function RaldBox({ state, children, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const prevState = useRef<BoxState>('idle');

  const stateIndex: Record<BoxState, number> = { idle: 0, typing: 1, error: 2, success: 3 };

  useEffect(() => {
    if (prevState.current !== state) {
      prevState.current = state;
      Animated.timing(progress, {
        toValue: stateIndex[state],
        duration: 280,
        useNativeDriver: false,
      }).start();
    }
  }, [state]);

  const color = progress.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      STATE_COLOR.idle,
      STATE_COLOR.typing,
      STATE_COLOR.error,
      STATE_COLOR.success,
    ],
  });

  const glowColor = progress.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      STATE_GLOW.idle,
      STATE_GLOW.typing,
      STATE_GLOW.error,
      STATE_GLOW.success,
    ],
  });

  return (
    <Animated.View style={[styles.container, style, { shadowColor: glowColor as any }]}>
      <Corner pos="tl" color={color} />
      <Corner pos="tr" color={color} />
      <Corner pos="bl" color={color} />
      <Corner pos="br" color={color} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
});
