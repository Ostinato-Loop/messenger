import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PhoneCall, Video, MicOff, Mic, VideoOff, PhoneOff } from "lucide-react";

import { useTRTC } from "@/hooks/useTRTC";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calls")({
  component: CallsPage,
  ssr: false,
});

type RecentCall = {
  id: string;
  chat_id: string;
  caller_id: string;
  type: "voice" | "video";
  started_at: string;
  ended_at: string | null;
  peer_name?: string;
};

function CallsPage() {
  const { user } = useAuth();
  const { callState, start, end, toggleAudio, toggleVideo } = useTRTC();
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [activePanel, setActivePanel] = useState<{
    roomId: string;
    mode: "voice" | "video";
    peerName: string;
  } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("calls")
      .select("*")
      .eq("caller_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRecent((data as RecentCall[]) ?? []))
      .catch(() => {});
  }, [user]);

  async function initiateCall(
    chatId: string,
    peerName: string,
    mode: "voice" | "video",
  ) {
    if (!user) return;
    const roomId = `chat_${chatId}`;
    setActivePanel({ roomId, mode, peerName });
    await start({
      roomId,
      userId: user.id,
      mode,
      localVideoEl: localVideoRef.current,
      remoteVideoEl: remoteVideoRef.current,
    });
    supabase
      .from("calls")
      .insert({
        chat_id: chatId,
        caller_id: user.id,
        type: mode,
        started_at: new Date().toISOString(),
      })
      .then(() => {})
      .catch(() => {});
  }

  async function hangUp() {
    await end();
    setActivePanel(null);
  }

  const inCall =
    callState.state === "connected" || callState.state === "connecting";

  return (
    <div className="flex min-h-screen flex-col px-5 pt-12 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Loop
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Calls<span className="text-gradient-purple">.</span>
          </h1>
        </div>
      </motion.header>

      {activePanel && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 relative overflow-hidden rounded-3xl glass-raised p-5"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          {activePanel.mode === "video" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full rounded-2xl bg-black/40 aspect-video object-cover mb-3"
            />
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-breathe" />
                <PhoneCall size={32} className="text-primary" />
              </div>
            </div>
          )}

          <p className="text-center text-lg font-semibold">{activePanel.peerName}</p>
          <p className="text-center text-sm text-muted-foreground mb-5">
            {callState.state === "connecting" ? "Connecting…" : "In call"}
          </p>

          {activePanel.mode === "video" && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-20 right-4 w-24 rounded-xl bg-black/60 aspect-video object-cover border border-white/10"
            />
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleAudio}
              className="flex h-12 w-12 items-center justify-center rounded-full glass transition hover:bg-accent/30"
            >
              {callState.audioMuted
                ? <MicOff size={20} className="text-destructive" />
                : <Mic size={20} />}
            </button>
            {activePanel.mode === "video" && (
              <button
                onClick={toggleVideo}
                className="flex h-12 w-12 items-center justify-center rounded-full glass transition hover:bg-accent/30"
              >
                {callState.videoMuted
                  ? <VideoOff size={20} className="text-destructive" />
                  : <Video size={20} />}
              </button>
            )}
            <button
              onClick={hangUp}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive transition hover:brightness-110"
            >
              <PhoneOff size={22} className="text-white" />
            </button>
          </div>

          {callState.error && (
            <p className="mt-3 text-center text-xs text-destructive">{callState.error}</p>
          )}
        </motion.div>
      )}

      {recent.length === 0 && !inCall && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-auto mb-auto flex flex-col items-center justify-center text-center"
        >
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass-raised">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-primary/15 blur-2xl animate-breathe" />
            <PhoneCall size={32} style={{ color: "oklch(0.78 0.18 300)" }} />
          </div>
          <h2 className="text-xl font-medium">No calls yet</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Tap the phone or video icon in any chat to start a call.
          </p>
        </motion.div>
      )}

      {recent.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent
          </h2>
          {recent.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-4 rounded-2xl glass p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                {c.type === "video"
                  ? <Video size={18} className="text-primary" />
                  : <PhoneCall size={18} className="text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.peer_name ?? c.chat_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.started_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => initiateCall(c.chat_id, c.peer_name ?? "User", c.type)}
                className="rounded-full p-2 text-primary hover:bg-primary/10 transition"
                aria-label="Call back"
              >
                {c.type === "video" ? <Video size={18} /> : <PhoneCall size={18} />}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
