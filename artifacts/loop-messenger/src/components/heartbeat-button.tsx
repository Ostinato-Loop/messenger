import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeartbeatButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

const HEARTBEAT_PATH = "M0,20 L8,20 L12,4 L16,36 L20,20 L24,20 L28,10 L32,30 L36,20 L60,20";

export function HeartbeatButton({
  onClick,
  loading = false,
  disabled = false,
  children,
  className = "",
  "data-testid": testId,
}: HeartbeatButtonProps) {
  const [clicked, setClicked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (disabled || loading) return;
    setClicked(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onClick();
  };

  // Reset clicked state if loading stops
  React.useEffect(() => {
    if (!loading && clicked) {
      timeoutRef.current = setTimeout(() => setClicked(false), 400);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [loading, clicked]);

  const showHeartbeat = (clicked || loading);

  return (
    <motion.button
      type="submit"
      onClick={handleClick}
      disabled={disabled || loading}
      data-testid={testId}
      className={`relative w-full h-12 rounded-xl text-lg font-semibold overflow-hidden
        bg-primary text-white select-none
        shadow-[0_0_24px_rgba(255,107,0,0.45)]
        transition-opacity
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${className}`}
      whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
    >
      {/* Filled bg always orange */}
      <span className="absolute inset-0 bg-primary" />

      {/* Ripple burst on click */}
      <AnimatePresence>
        {showHeartbeat && (
          <motion.span
            key="ripple"
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Heartbeat SVG waveform — only after click */}
      <AnimatePresence>
        {showHeartbeat && (
          <motion.span
            key="hb"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <svg width="100%" height="100%" viewBox="0 0 200 48" preserveAspectRatio="xMidYMid meet" className="absolute inset-0">
              <defs>
                <linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <mask id="hbMask">
                  <motion.rect
                    x={0} y={0} width={60} height={48}
                    fill="white"
                    initial={{ x: -60 }}
                    animate={{ x: 200 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "linear", repeatDelay: 0.3 }}
                  />
                </mask>
              </defs>
              {/* Static faint line */}
              <path d="M0,24 L200,24" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              {/* Animated heartbeat wave */}
              <motion.path
                d="M0,24 L60,24 L70,24 L78,8 L84,40 L90,24 L98,16 L106,32 L112,24 L130,24 L200,24"
                stroke="url(#hbGrad)"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                mask="url(#hbMask)"
              />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>

      {/* Label */}
      <span className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
        {children}
      </span>
    </motion.button>
  );
}
