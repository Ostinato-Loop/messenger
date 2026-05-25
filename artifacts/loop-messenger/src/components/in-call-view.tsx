import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, ChevronDown, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCall } from "@/lib/call-provider";
import { formatDuration } from "@/lib/trtc-client";

interface CallControlProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
}

function CallControl({ icon, label, onClick, active, danger, large }: CallControlProps) {
  const base = large ? "w-18 h-18" : "w-14 h-14";
  let bg = "bg-white/10 hover:bg-white/20";
  if (danger) bg = "bg-destructive hover:bg-destructive/80 shadow-xl shadow-destructive/40";
  else if (active) bg = "bg-white/90";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        className={`${large ? "w-[72px] h-[72px]" : "w-14 h-14"} rounded-full flex items-center justify-center transition-all active:scale-90 ${bg}`}
        aria-label={label}
      >
        <span className={active && !danger ? "text-zinc-900" : "text-white"}>
          {icon}
        </span>
      </button>
      <span className="text-white/50 text-[10px] uppercase tracking-wide font-medium">{label}</span>
    </div>
  );
}

export function InCallView() {
  const { call, endCall, toggleMute, toggleCamera } = useCall();
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!call || call.state !== "active") { setElapsed(0); return; }
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [call?.state]);

  if (!call) return null;

  const stateLabel =
    call.state === "calling"  ? "Calling…" :
    call.state === "ringing"  ? "Ringing…" :
    call.state === "ending"   ? "Call ended" :
    formatDuration(elapsed);

  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2.5 bg-green-600 text-white px-4 py-2.5 rounded-full shadow-2xl shadow-green-500/40 hover:bg-green-500 transition-colors"
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-white"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-sm font-semibold">
            {call.state === "active" ? formatDuration(elapsed) : call.state === "calling" ? "Calling…" : "Connecting…"}
          </span>
          <span className="text-white/60 text-xs truncate max-w-[80px]">{call.peerName}</span>
        </button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="in-call"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-[#0d0d12] via-[#111118] to-[#0a0a10] overflow-hidden"
      >
        {/* Ambient glow behind avatar */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-safe pt-12">
          <div className="text-white/40 text-xs uppercase tracking-widest font-medium">
            {call.type === "video" ? "Video Call" : "Voice Call"}
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Peer info */}
        <div className="flex flex-col items-center gap-5 flex-1 justify-center pb-8">
          <div className="relative">
            {call.state !== "active" && (
              <>
                <motion.div
                  className="absolute inset-[-20px] rounded-full border border-primary/25"
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="absolute inset-[-40px] rounded-full border border-primary/15"
                  animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                />
              </>
            )}
            {call.state === "active" && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-green-500/40"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <Avatar className="w-32 h-32 border-4 border-white/8 shadow-2xl">
              <AvatarImage src={call.peerAvatar ?? ""} />
              <AvatarFallback className="text-4xl bg-primary/15 text-primary font-bold">
                {(call.peerName ?? "?").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-white text-2xl font-bold tracking-tight">{call.peerName ?? "Unknown"}</h2>
            <motion.p
              className="text-white/50 text-sm font-medium"
              animate={call.state !== "active" ? { opacity: [1, 0.4, 1] } : undefined}
              transition={call.state !== "active" ? { duration: 1.5, repeat: Infinity } : undefined}
            >
              {stateLabel}
            </motion.p>
          </div>
        </div>

        {/* Controls */}
        <div className="pb-safe pb-14 space-y-6 px-8">
          {/* Primary controls row */}
          <div className="flex items-end justify-center gap-8">
            <CallControl
              icon={call.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              label={call.isMuted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              active={call.isMuted}
            />

            <CallControl
              icon={<PhoneOff className="w-7 h-7" />}
              label="End"
              onClick={endCall}
              danger
              large
            />

            {call.type === "video" ? (
              <CallControl
                icon={call.isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                label={call.isCameraOff ? "Camera On" : "Camera Off"}
                onClick={toggleCamera}
                active={call.isCameraOff}
              />
            ) : (
              <CallControl
                icon={speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                label={speakerOn ? "Speaker" : "Earpiece"}
                onClick={() => setSpeakerOn(s => !s)}
                active={!speakerOn}
              />
            )}
          </div>

          {/* Secondary row — flip camera for video */}
          {call.type === "video" && (
            <div className="flex justify-center">
              <CallControl
                icon={<RotateCcw className="w-5 h-5" />}
                label="Flip"
                onClick={() => {}}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
