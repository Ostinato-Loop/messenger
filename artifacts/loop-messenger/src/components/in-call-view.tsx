import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCall } from "@/lib/call-provider";
import { formatDuration } from "@/lib/trtc-client";

export function InCallView() {
  const { call, endCall, toggleMute, toggleCamera } = useCall();
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!call || call.state !== "active") return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [call?.state]);

  if (!call) return null;

  // Minimized floating pill
  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-full shadow-xl shadow-green-500/30 hover:bg-green-500 transition-colors"
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-white"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-sm font-medium">{call.state === "active" ? formatDuration(elapsed) : call.state === "calling" ? "Calling…" : "Connecting…"}</span>
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="in-call"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex flex-col items-center justify-between bg-gradient-to-b from-zinc-900 via-zinc-900 to-black"
      >
        {/* Minimize button */}
        <div className="w-full flex justify-end p-4">
          <button
            onClick={() => setMinimized(true)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Peer info */}
        <div className="flex flex-col items-center gap-6 flex-1 justify-center">
          {/* Animated rings */}
          <div className="relative">
            {call.state !== "active" && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border border-primary/30"
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border border-primary/20"
                  animate={{ scale: [1, 2], opacity: [0.4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
              </>
            )}
            <Avatar className="w-28 h-28 border-4 border-white/10">
              <AvatarImage src={call.peerAvatar ?? ""} />
              <AvatarFallback className="text-4xl bg-primary/20 text-primary">
                {(call.peerName ?? "?").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center">
            <h2 className="text-white text-2xl font-semibold">{call.peerName ?? "Unknown"}</h2>
            <motion.p
              className="text-white/60 text-sm mt-1"
              animate={call.state !== "active" ? { opacity: [1, 0.5, 1] } : undefined}
              transition={call.state !== "active" ? { duration: 1.2, repeat: Infinity } : undefined}
            >
              {call.state === "calling"
                ? "Calling…"
                : call.state === "ringing"
                ? "Ringing…"
                : call.state === "ending"
                ? "Call ended"
                : formatDuration(elapsed)}
            </motion.p>
          </div>

          {/* Call type badge */}
          <span className="text-white/40 text-xs uppercase tracking-widest">
            {call.type === "video" ? "📹 Video Call" : "🎙️ Voice Call"} · TRTC
          </span>
        </div>

        {/* Control buttons */}
        <div className="w-full pb-16">
          <div className="flex items-center justify-center gap-6">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                call.isMuted ? "bg-white/90 text-zinc-900" : "bg-white/10 text-white"
              }`}
              aria-label={call.isMuted ? "Unmute" : "Mute"}
            >
              {call.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* End call */}
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-destructive hover:bg-destructive/80 flex items-center justify-center shadow-xl shadow-destructive/30 transition-all active:scale-95"
              aria-label="End call"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>

            {/* Camera (video calls only) */}
            {call.type === "video" ? (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  call.isCameraOff ? "bg-white/90 text-zinc-900" : "bg-white/10 text-white"
                }`}
                aria-label={call.isCameraOff ? "Enable camera" : "Disable camera"}
              >
                {call.isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            ) : (
              <div className="w-14 h-14" />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
