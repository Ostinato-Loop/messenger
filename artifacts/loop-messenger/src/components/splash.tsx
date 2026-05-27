import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-orange-500/8 blur-[110px]" />
          </div>

          {/* Scanning line */}
          <motion.div
            className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent pointer-events-none"
            initial={{ top: "0%" }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.8, ease: "linear", repeat: Infinity, repeatDelay: 0.4 }}
          />

          {/* App icon */}
          <motion.div
            initial={{ scale: 0.72, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="relative mb-8"
          >
            <motion.div
              className="absolute inset-0 rounded-[28px] border border-orange-500/40"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
            <div className="w-24 h-24 rounded-[28px] flex items-center justify-center bg-[#0F1416] border border-orange-500/25 shadow-[0_0_36px_rgba(255,107,0,0.28)]">
              {/* Loop "L" monogram — clean SVG path, no font dependency */}
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-label="Loop">
                <path d="M12 8h4v24h16v4H12V8z" fill="#FF7A00" opacity="0.9" />
                <path d="M18 14h4v12h10v4H18V14z" fill="#FF7A00" opacity="0.5" />
              </svg>
            </div>
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Loop</h1>
            <p className="text-xs tracking-[0.25em] uppercase text-orange-400/60 font-medium">Messenger</p>
          </motion.div>

          {/* Boot progress */}
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

          <motion.p
            className="absolute bottom-8 text-[10px] text-white/15 tracking-widest font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            V1.0.0
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
