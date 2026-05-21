import { motion } from "framer-motion";

type Props = {
  size?: number;
  className?: string;
  animated?: boolean;
};

/**
 * Loop infinity logo — neon lemon green, matches brand asset.
 * Used in splash, nav centre button, and brand surfaces.
 */
export function LoopMark({ size = 96, className = "", animated = true }: Props) {
  const Wrapper = animated ? motion.div : "div";
  const wrapperProps = animated
    ? ({
        animate: { rotate: [0, 0.7, -0.7, 0] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
      } as object)
    : {};

  return (
    <Wrapper
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center ${className}`}
      {...wrapperProps}
    >
      {/* Neon glow bloom behind the mark */}
      {animated && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full animate-breathe"
          style={{ background: "radial-gradient(circle, oklch(0.92 0.30 122 / 0.35) 0%, transparent 70%)" }}
        />
      )}

      {/* The ∞ mark — faithful recreation of the brand logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative"
      >
        <defs>
          <filter id="loopGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="loopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="oklch(0.92 0.30 122)" />
            <stop offset="100%" stopColor="oklch(0.78 0.26 142)" />
          </linearGradient>
        </defs>

        {/* Infinity path — two overlapping loops */}
        <path
          d="
            M 60 60
            C 60 48, 50 36, 35 36
            C 20 36, 12 47, 12 60
            C 12 73, 20 84, 35 84
            C 50 84, 60 72, 60 60
            C 60 48, 70 36, 85 36
            C 100 36, 108 47, 108 60
            C 108 73, 100 84, 85 84
            C 70 84, 60 72, 60 60
            Z
          "
          stroke="url(#loopGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#loopGlow)"
        />
      </svg>
    </Wrapper>
  );
}
