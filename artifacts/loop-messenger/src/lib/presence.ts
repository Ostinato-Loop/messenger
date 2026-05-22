/**
 * Supabase Presence — real-time online/offline status.
 * Falls back gracefully to the isOnline DB field when Supabase is unconfigured.
 */
import { useEffect, useState, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function usePresence(myUserId: number | undefined) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase || !myUserId) return;

    const channel = supabase.channel("presence:global", {
      config: { presence: { key: String(myUserId) } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId: number }>();
        const ids = new Set<number>();
        Object.values(state).forEach((presences) =>
          presences.forEach((p) => ids.add(p.userId))
        );
        setOnlineUserIds(ids);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          (newPresences as unknown as Array<{ userId: number }>).forEach((p) =>
            next.add(p.userId)
          );
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          (leftPresences as unknown as Array<{ userId: number }>).forEach((p) =>
            next.delete(p.userId)
          );
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: myUserId, online: true });
        }
      });

    return () => {
      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [myUserId]);

  return { onlineUserIds };
}
