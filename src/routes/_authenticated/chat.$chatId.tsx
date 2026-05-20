import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  PhoneCall,
  Video,
  User as UserIcon,
  Sparkles,
  MicOff,
  Mic,
  VideoOff,
  PhoneOff,
} from "lucide-react";

import { ChatComposer } from "@/components/messaging/ChatComposer";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { TypingDots } from "@/components/messaging/TypingDots";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useTRTC } from "@/hooks/useTRTC";
import {
  useMessages,
  useSendMessage,
  useToggleReaction,
  useTyping,
  usePresence,
  type ChatWithMeta,
  type Message,
  type Profile,
} from "@/hooks/useMessaging";

export const Route = createFileRoute("/_authenticated/chat/$chatId")({
  component: ChatThread,
  ssr: false,
});

function ChatThread() {
  const { chatId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const presence = usePresence();

  const [chat, setChat] = useState<ChatWithMeta | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const { data: messages = [] } = useMessages(chatId);
  const send = useSendMessage(chatId);
  const toggleReaction = useToggleReaction();
  const { othersTyping, sendTyping } = useTyping(chatId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: chatRow } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .maybeSingle();
      const { data: memberRows } = await supabase
        .from("chat_members")
        .select("user_id, messenger_profiles!inner(user_id, username, display_name, avatar_url)")
        .eq("chat_id", chatId);
      if (cancelled) return;
      const m = (memberRows ?? []).map((r: any) => r.messenger_profiles as Profile);
      setMembers(m);
      if (chatRow) {
        const others = m.filter((p) => p.user_id !== user?.id);
        const isDirect = chatRow.type === "direct";
        setChat({
          ...(chatRow as any),
          members: m,
          last_read_at: new Date().toISOString(),
          pinned: false,
          archived: false,
          unread: false,
          display: isDirect
            ? {
                title: others[0]?.display_name ?? others[0]?.username ?? "Unknown",
                avatar: others[0]?.avatar_url ?? null,
              }
            : { title: chatRow.name ?? "Group", avatar: chatRow.avatar_url },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, user?.id]);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    members.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [members]);

  const otherDirect =
    chat?.type === "direct" ? members.find((m) => m.user_id !== user?.id) : null;

  const headerSubtitle =
    othersTyping.length > 0
      ? "typing…"
      : chat?.type === "direct"
        ? presence.isOnline(otherDirect?.user_id)
          ? "online"
          : "offline"
        : `${members.length} members`;

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, othersTyping.length]);

  const { callState, start: startCall, end: endCall, toggleAudio, toggleVideo } = useTRTC();
  const [callPanel, setCallPanel] = useState<{
    mode: "voice" | "video";
    peerName: string;
  } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const handleStartCall = useCallback(
    async (mode: "voice" | "video") => {
      if (!user) return;
      const peerName =
        otherDirect?.display_name ?? otherDirect?.username ?? "User";
      setCallPanel({ mode, peerName });
      await startCall({
        roomId: `chat_${chatId}`,
        userId: user.id,
        mode,
        localVideoEl: localVideoRef.current,
        remoteVideoEl: remoteVideoRef.current,
      });
    },
    [user, chatId, startCall, otherDirect],
  );

  const handleEndCall = useCallback(async () => {
    await endCall();
    setCallPanel(null);
  }, [endCall]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 safe-top glass-raised border-b border-border/50"
      >
        <div className="flex items-center gap-3 px-3 py-3">
          <button
            onClick={() => navigate({ to: "/chats" })}
            className="rounded-full p-2 text-foreground/90 transition hover:bg-accent/30"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="relative">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-raised">
              {chat?.display.avatar ? (
                <img
                  src={chat.display.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <UserIcon size={18} />
                </div>
              )}
            </div>
            {chat?.type === "direct" && presence.isOnline(otherDirect?.user_id) && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-[oklch(0.72_0.2_145)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold">
              {chat?.display.title ?? " "}
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {othersTyping.length > 0 ? <TypingDots small /> : null}
              {headerSubtitle}
            </p>
          </div>
          <button
            onClick={() => handleStartCall("voice")}
            className="rounded-full p-2 text-foreground/90 transition hover:bg-accent/30 disabled:opacity-40"
            aria-label="Voice call"
            disabled={callPanel !== null}
          >
            <PhoneCall size={18} />
          </button>
          <button
            onClick={() => handleStartCall("video")}
            className="rounded-full p-2 text-foreground/90 transition hover:bg-accent/30 disabled:opacity-40"
            aria-label="Video call"
            disabled={callPanel !== null}
          >
            <Video size={18} />
          </button>
        </div>
      </motion.header>

      {callPanel && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-3 mt-2 mb-1 overflow-hidden rounded-2xl glass-raised p-4"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {callPanel.mode === "video" ? (
            <div className="relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className="w-full rounded-xl bg-black/40 aspect-video object-cover"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-2 right-2 w-20 rounded-lg bg-black/60 aspect-video object-cover border border-white/10"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
                <PhoneCall size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{callPanel.peerName}</p>
                <p className="text-xs text-muted-foreground">
                  {callState.state === "connecting" ? "Connecting…" : "In call"}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              onClick={toggleAudio}
              className="flex h-10 w-10 items-center justify-center rounded-full glass transition hover:bg-accent/30"
            >
              {callState.audioMuted ? (
                <MicOff size={18} className="text-destructive" />
              ) : (
                <Mic size={18} />
              )}
            </button>
            {callPanel.mode === "video" && (
              <button
                onClick={toggleVideo}
                className="flex h-10 w-10 items-center justify-center rounded-full glass transition hover:bg-accent/30"
              >
                {callState.videoMuted ? (
                  <VideoOff size={18} className="text-destructive" />
                ) : (
                  <Video size={18} />
                )}
              </button>
            )}
            <button
              onClick={handleEndCall}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive transition hover:brightness-110"
            >
              <PhoneOff size={20} className="text-white" />
            </button>
          </div>
          {callState.error && (
            <p className="mt-2 text-center text-xs text-destructive">
              {callState.error}
            </p>
          )}
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-4 pb-44">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-xs text-center">
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl glass-raised">
                <Sparkles size={20} style={{ color: "oklch(0.78 0.18 300)" }} />
              </div>
              <p className="text-sm text-muted-foreground">
                This is the start of your conversation. Say hi.
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const isMine = m.sender_id === user?.id;
            const sameSenderAsPrev = prev && prev.sender_id === m.sender_id;
            const replyToMessage = m.reply_to
              ? (messages.find((x) => x.id === m.reply_to) ?? null)
              : null;
            const senderProfile = profilesById.get(m.sender_id);
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isMine={isMine}
                showAvatar={!sameSenderAsPrev}
                senderName={
                  !isMine && chat?.type === "group"
                    ? (senderProfile?.display_name ?? "Member")
                    : undefined
                }
                senderAvatar={senderProfile?.avatar_url ?? null}
                replyToMessage={replyToMessage}
                onReply={setReplyTo}
                onReact={toggleReaction}
                currentUserId={user?.id ?? ""}
              />
            );
          })}
          {othersTyping.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="h-7 w-7 rounded-full bg-surface-raised" />
              <div className="rounded-2xl rounded-bl-md glass px-3 py-2 text-muted-foreground">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatComposer
        onSend={send}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
