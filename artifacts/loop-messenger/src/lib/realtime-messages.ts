/**
 * Supabase Realtime CDC — instant message updates via Postgres change events.
 * When Supabase is unconfigured, the existing adaptive polling (useNetworkQuality)
 * handles updates automatically — no action needed.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMessagesQueryKey,
  getListConversationsQueryKey,
  getGetConversationStatsQueryKey,
} from "@workspace/api-client-react";
import { supabase } from "./supabase";

export function useRealtimeMessages(conversationId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: getListMessagesQueryKey(conversationId),
          });
          queryClient.invalidateQueries({
            queryKey: getListConversationsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetConversationStatsQueryKey(),
          });
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}
