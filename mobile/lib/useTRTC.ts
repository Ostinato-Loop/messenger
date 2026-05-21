/**
 * Loop Messenger — TRTC voice/video call hook (mobile stub)
 *
 * The Tencent TRTC React Native SDK requires a native build (no Expo Go support).
 * This stub provides the full call UI state machine so the design + flow work
 * immediately. Wire up the real TRTC SDK after an EAS native build.
 */
import { useState, useCallback } from 'react';

export type CallMode = 'voice' | 'video';

export type TRTCCallState = {
  active: boolean;
  roomId: string | null;
  mode: CallMode;
  audioMuted: boolean;
  videoMuted: boolean;
  connecting: boolean;
  duration: number;
};

const DEFAULT: TRTCCallState = {
  active: false,
  roomId: null,
  mode: 'voice',
  audioMuted: false,
  videoMuted: false,
  connecting: false,
  duration: 0,
};

export function useTRTC() {
  const [callState, setCallState] = useState<TRTCCallState>(DEFAULT);

  const start = useCallback(async (opts: {
    roomId: string;
    userId: string;
    mode: CallMode;
  }) => {
    setCallState({ ...DEFAULT, active: true, roomId: opts.roomId, mode: opts.mode, connecting: true });
    // Simulate connection delay — replace with real TRTC SDK call
    await new Promise((r) => setTimeout(r, 1500));
    setCallState((s) => ({ ...s, connecting: false }));
  }, []);

  const end = useCallback(async () => {
    setCallState(DEFAULT);
  }, []);

  const toggleAudio = useCallback(() => {
    setCallState((s) => ({ ...s, audioMuted: !s.audioMuted }));
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState((s) => ({ ...s, videoMuted: !s.videoMuted }));
  }, []);

  return { callState, start, end, toggleAudio, toggleVideo };
}
