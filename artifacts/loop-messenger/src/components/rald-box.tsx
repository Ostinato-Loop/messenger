import { motion } from "framer-motion";

type RaldState = "idle" | "typing" | "success" | "error";

interface RaldBoxProps {
  state?: RaldState;
  className?: string;
  size?: number;
}

const STATE_COLORS: Record<RaldState, { line: string; glow: string; circle: string }> = {
  idle:    { line: "rgba(255,255,255,0.08)", glow: "none",                             circle: "rgba(255,255,255,0.15)" },
  typing:  { line: "#F59E0B",               glow: "0 0 12px 2px rgba(245,158,11,0.7)", circle: "#F59E0B" },
  success: { line: "#22C55E",               glow: "0 0 12px 2px rgba(34,197,94,0.7)",  circle: "#22C55E" },
  error:   { line: "#EF4444",               glow: "0 0 12px 2px rgba(239,68,68,0.7)",  circle: "#EF4444" },
};

export function RaldBox({ state = "idle", className = "", size = 36 }: RaldBoxProps) {
  const colors = STATE_COLORS[state];
  const strokeW = 1.5;
  const r = size * 0.14;

  return (
    <div className={`pointer-events-none select-none ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer box lines — top + right only (corner indicator) */}
        <motion.path
          d={`M${size * 0.55} ${strokeW} L${size - strokeW - r} ${strokeW} Q${size - strokeW} ${strokeW} ${size - strokeW} ${strokeW + r} L${size - strokeW} ${size * 0.55}`}
          stroke={colors.line}
          strokeWidth={strokeW}
          strokeLinecap="round"
          fill="none"
          animate={{ stroke: colors.line }}
          transition={{ duration: 0.35 }}
          style={{ filter: state !== "idle" ? colors.glow : undefined }}
        />
        {/* Circle at the corner vertex */}
        <motion.circle
          cx={size - strokeW}
          cy={strokeW}
          r={r * 0.8}
          fill={colors.circle}
          animate={{ fill: colors.circle }}
          transition={{ duration: 0.35 }}
          style={{ filter: state !== "idle" ? colors.glow : undefined }}
        />
        {/* Pulse ring on state change */}
        {state !== "idle" && (
          <motion.circle
            cx={size - strokeW}
            cy={strokeW}
            r={r * 0.8}
            stroke={colors.circle}
            strokeWidth={1}
            fill="none"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: `${size - strokeW}px ${strokeW}px` }}
          />
        )}
      </svg>
    </div>
  );
}

/** Four-corner RALD frame — wraps a card */
export function RaldFrame({
  state = "idle",
  children,
  className = "",
}: {
  state?: RaldState;
  children: React.ReactNode;
  className?: string;
}) {
  const colors = STATE_COLORS[state];
  const cornerSize = 28;

  return (
    <div className={`relative ${className}`}>
      {/* Top-left */}
      <div className="absolute top-0 left-0 -translate-x-[1px] -translate-y-[1px]">
        <svg width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`} fill="none">
          <motion.path
            d={`M${cornerSize * 0.55} 1.5 L${1.5 + 6} 1.5 Q1.5 1.5 1.5 ${1.5 + 6} L1.5 ${cornerSize * 0.55}`}
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
            animate={{ stroke: colors.line }}
            transition={{ duration: 0.35 }}
            style={{ filter: state !== "idle" ? colors.glow : undefined }}
          />
        </svg>
      </div>

      {/* Top-right */}
      <div className="absolute top-0 right-0 translate-x-[1px] -translate-y-[1px]">
        <svg width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`} fill="none">
          <motion.path
            d={`M${cornerSize * 0.45} 1.5 L${cornerSize - 1.5 - 6} 1.5 Q${cornerSize - 1.5} 1.5 ${cornerSize - 1.5} ${1.5 + 6} L${cornerSize - 1.5} ${cornerSize * 0.55}`}
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
            animate={{ stroke: colors.line }}
            transition={{ duration: 0.35 }}
            style={{ filter: state !== "idle" ? colors.glow : undefined }}
          />
          {/* Corner dot */}
          <motion.circle
            cx={cornerSize - 1.5}
            cy={1.5}
            r={3}
            fill={colors.circle}
            animate={{ fill: colors.circle }}
            transition={{ duration: 0.35 }}
          />
          {state !== "idle" && (
            <motion.circle
              cx={cornerSize - 1.5}
              cy={1.5}
              r={3}
              stroke={colors.circle}
              strokeWidth={1}
              fill="none"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
              style={{ transformOrigin: `${cornerSize - 1.5}px 1.5px` }}
            />
          )}
        </svg>
      </div>

      {/* Bottom-left */}
      <div className="absolute bottom-0 left-0 -translate-x-[1px] translate-y-[1px]">
        <svg width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`} fill="none">
          <motion.path
            d={`M1.5 ${cornerSize * 0.45} L1.5 ${cornerSize - 1.5 - 6} Q1.5 ${cornerSize - 1.5} ${1.5 + 6} ${cornerSize - 1.5} L${cornerSize * 0.55} ${cornerSize - 1.5}`}
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
            animate={{ stroke: colors.line }}
            transition={{ duration: 0.35 }}
            style={{ filter: state !== "idle" ? colors.glow : undefined }}
          />
        </svg>
      </div>

      {/* Bottom-right */}
      <div className="absolute bottom-0 right-0 translate-x-[1px] translate-y-[1px]">
        <svg width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`} fill="none">
          <motion.path
            d={`M${cornerSize - 1.5} ${cornerSize * 0.45} L${cornerSize - 1.5} ${cornerSize - 1.5 - 6} Q${cornerSize - 1.5} ${cornerSize - 1.5} ${cornerSize - 1.5 - 6} ${cornerSize - 1.5} L${cornerSize * 0.45} ${cornerSize - 1.5}`}
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
            animate={{ stroke: colors.line }}
            transition={{ duration: 0.35 }}
            style={{ filter: state !== "idle" ? colors.glow : undefined }}
          />
        </svg>
      </div>

      {children}
    </div>
  );
}
