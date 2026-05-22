/**
 * Supabase Broadcast — per-conversation typing indicators.
 * Fully silent when Supabase is unconfigured.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface TypingUser {
  userId: number;
  displayName: string;
}

interface TypingPayload {
  userId: number;
  displayName: string;
  typing: boolean;
}

export function useTyping(
  conversationId: number,
  myUserId: number | undefined,
  myDisplayName: string | undefined
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const clearTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: TypingPayload }) => {
        if (payload.userId === myUserId) return;

        const timers = clearTimers.current;
        const existing = timers.get(payload.userId);
        if (existing) clearTimeout(existing);

        if (payload.typing) {
          setTypingUsers((prev) =>
            prev.some((u) => u.userId === payload.userId)
              ? prev
              : [...prev, { userId: payload.userId, displayName: payload.displayName }]
          );
          const t = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
            timers.delete(payload.userId);
          }, 4000);
          timers.set(payload.userId, t);
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId));
        }
      })
      .subscribe();

    return () => {
      clearTimers.current.forEach(clearTimeout);
      clearTimers.current.clear();
      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, myUserId]);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!channelRef.current || !myUserId || !myDisplayName) return;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: myUserId, displayName: myDisplayName, typing } satisfies TypingPayload,
      });
    },
    [myUserId, myDisplayName]
  );

  /** Call this on every input onChange event */
  const onInputChange = useCallback(
    (value: string) => {
      if (value.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(true);
      }
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (value.length > 0) {
        stopTimerRef.current = setTimeout(() => {
          isTypingRef.current = false;
          sendTyping(false);
        }, 3000);
      } else if (isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(false);
      }
    },
    [sendTyping]
  );

  /** Call this when the user sends a message */
  const onSend = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
    }
  }, [sendTyping]);

  return { typingUsers, onInputChange, onSend };
}
