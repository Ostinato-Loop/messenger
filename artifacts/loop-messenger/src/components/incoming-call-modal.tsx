import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCall } from "@/lib/call-provider";

export function IncomingCallModal() {
  const { incomingCall, answerCall, rejectCall } = useCall();
  const [answering, setAnswering] = useState(false);

  // Ring for max 30s then auto-reject
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => rejectCall(incomingCall.callId), 30000);
    return () => clearTimeout(timer);
  }, [incomingCall, rejectCall]);

  const handleAnswer = async () => {
    if (!incomingCall || answering) return;
    setAnswering(true);
    try {
      await answerCall(incomingCall.callId);
    } catch {
      setAnswering(false);
    }
  };

  const handleReject = () => {
    if (!incomingCall) return;
    rejectCall(incomingCall.callId);
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          key="incoming-call"
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm mt-4 px-4"
        >
          <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
            {/* Animated glow */}
            <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60">
              <motion.div
                className="h-full w-1/2 bg-white/40 rounded-full"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="p-5 flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={incomingCall.initiatorAvatar ?? ""} />
                  <AvatarFallback className="text-lg bg-primary/20 text-primary">
                    {(incomingCall.initiatorName ?? "?").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Incoming {incomingCall.type === "video" ? "Video" : "Voice"} Call
                </p>
                <p className="font-semibold text-base truncate mt-0.5">
                  {incomingCall.initiatorName ?? "Unknown caller"}
                </p>
                <motion.p
                  className="text-xs text-primary mt-0.5"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  Calling…
                </motion.p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReject}
                  className="w-12 h-12 rounded-full bg-destructive/90 hover:bg-destructive flex items-center justify-center shadow-lg transition-all active:scale-95"
                  aria-label="Reject call"
                >
                  <PhoneOff className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={handleAnswer}
                  disabled={answering}
                  className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-[0_0_16px_rgba(34,197,94,0.5)] transition-all active:scale-95 disabled:opacity-60"
                  aria-label="Answer call"
                >
                  {incomingCall.type === "video"
                    ? <Video className="w-5 h-5 text-white" />
                    : <Phone className="w-5 h-5 text-white" />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
