/**
 * useTRTC — Tencent TRTC voice/video call hook.
 * Lazy-loads trtc-js-sdk on first call to keep initial bundle lean.
 *
 * Usage:
 *   const { callState, start, end, toggleAudio, toggleVideo } = useTRTC();
 *   await start({ roomId: "chat_abc", userId: user.id, mode: "voice" });
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type CallMode = "voice" | "video";
export type CallStatus = "idle" | "connecting" | "connected" | "ended" | "error";

export type TRTCCallState = {
  state: CallStatus;
  mode: CallMode;
  roomId: string | null;
  userId: string | null;
  remoteUsers: string[];
  audioMuted: boolean;
  videoMuted: boolean;
  error: string | null;
};

const INITIAL: TRTCCallState = {
  state: "idle",
  mode: "voice",
  roomId: null,
  userId: null,
  remoteUsers: [],
  audioMuted: false,
  videoMuted: false,
  error: null,
};

export type StartOptions = {
  roomId: string;
  userId: string;
  mode?: CallMode;
  localVideoEl?: HTMLVideoElement | null;
  remoteVideoEl?: HTMLVideoElement | null;
};

export function useTRTC() {
  const [callState, setCallState] = useState<TRTCCallState>(INITIAL);
  const clientRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);

  function patch(update: Partial<TRTCCallState>) {
    setCallState((s) => ({ ...s, ...update }));
  }

  const start = useCallback(
    async ({ roomId, userId, mode = "voice", localVideoEl, remoteVideoEl }: StartOptions) => {
      patch({ state: "connecting", mode, roomId, userId, error: null });

      try {
        // Fetch UserSig from secure server-side API
        const res = await fetch("/api/trtc-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, userId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Server error" }));
          throw new Error((err as any).error ?? "Failed to get TRTC token");
        }
        const { userSig, sdkAppId } = (await res.json()) as {
          userSig: string;
          sdkAppId: number;
        };

        // Lazy-load TRTC Web SDK
        const { default: TRTC } = await import("trtc-js-sdk");

        const client = TRTC.createClient({ sdkAppId, userId, userSig, mode: "rtc" });
        clientRef.current = client;

        client.on("stream-added", async (evt: any) => {
          await client.subscribe(evt.stream);
        });
        client.on("stream-subscribed", (evt: any) => {
          if (remoteVideoEl) evt.stream.play(remoteVideoEl);
        });
        client.on("peer-join", (evt: any) => {
          setCallState((s) => ({
            ...s,
            remoteUsers: [...s.remoteUsers, evt.userId],
          }));
        });
        client.on("peer-leave", (evt: any) => {
          setCallState((s) => ({
            ...s,
            remoteUsers: s.remoteUsers.filter((u) => u !== evt.userId),
          }));
        });
        client.on("error", (err: any) => {
          patch({ state: "error", error: String(err?.message ?? err) });
        });

        // Room ID must be numeric for TRTC; derive from chatId string
        const numericRoom =
          Number(roomId.replace(/\D/g, "").slice(0, 10)) || Math.floor(Math.random() * 1e9);
        await client.join({ roomId: numericRoom });

        const localStream = TRTC.createStream({
          userId,
          audio: true,
          video: mode === "video",
        });
        await localStream.initialize();
        if (localVideoEl && mode === "video") localStream.play(localVideoEl);
        localStreamRef.current = localStream;
        await client.publish(localStream);

        patch({ state: "connected" });
      } catch (err: any) {
        patch({ state: "error", error: err?.message ?? String(err) });
      }
    },
    [],
  );

  const end = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.stop();
        if (clientRef.current) {
          await clientRef.current.unpublish(localStreamRef.current).catch(() => {});
        }
        localStreamRef.current.close();
        localStreamRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave().catch(() => {});
        clientRef.current.destroy();
        clientRef.current = null;
      }
    } catch {
      // best-effort cleanup
    }
    setCallState(INITIAL);
  }, []);

  const toggleAudio = useCallback(async () => {
    if (!localStreamRef.current) return;
    setCallState((s) => {
      if (s.audioMuted) {
        localStreamRef.current?.unmuteAudio();
      } else {
        localStreamRef.current?.muteAudio();
      }
      return { ...s, audioMuted: !s.audioMuted };
    });
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    setCallState((s) => {
      if (s.videoMuted) {
        localStreamRef.current?.unmuteVideo();
      } else {
        localStreamRef.current?.muteVideo();
      }
      return { ...s, videoMuted: !s.videoMuted };
    });
  }, []);

  // Auto-cleanup on component unmount
  useEffect(() => () => { end(); }, [end]);

  return { callState, start, end, toggleAudio, toggleVideo };
}
