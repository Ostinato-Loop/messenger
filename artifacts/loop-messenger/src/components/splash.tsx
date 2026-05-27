import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RaldLogo } from "@/components/rald-logo";

interface SplashProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("out"), 2000);
    const t3 = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {phase !== "out" ? (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070809] overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Deep radial glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[120px]" />
          </div>

          {/* Scanning line */}
          <motion.div
            className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent pointer-events-none"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.8, ease: "linear", repeat: Infinity, repeatDelay: 0.4 }}
          />

          {/* Logo container */}
          <motion.div
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative mb-8"
          >
            {/* Outer ring pulse */}
            <motion.div
              className="absolute inset-0 rounded-[28px] border border-orange-500/40"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
            <motion.div
              className="absolute inset-0 rounded-[28px] border border-orange-500/20"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1.65, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
            />

            {/* Logo box */}
            <div className="w-28 h-28 rounded-[28px] flex items-center justify-center bg-[#0F1416] border border-orange-500/30 shadow-[0_0_40px_rgba(255,107,0,0.35)] p-4">
              <RaldLogo height={52} theme="dark" accentColor="#FF7A00" />
            </div>
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Loop Messenger
            </h1>
            <p className="text-xs tracking-[0.25em] uppercase text-orange-400/70 font-medium">
              by RALD
            </p>
          </motion.div>

          {/* Boot progress bar */}
          <motion.div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-white/5 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div
              className="h-full bg-orange-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
            />
          </motion.div>

          {/* Version tag */}
          <motion.p
            className="absolute bottom-8 text-[10px] text-white/20 tracking-widest font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            V1.0.0 — RALD AUTH
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
