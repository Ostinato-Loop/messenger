import { motion } from "framer-motion";

type Props = {
  size?: number;
  className?: string;
  animated?: boolean;
};

/**
 * Loop infinity logo — a luminous neon mark.
 * Used in splash, nav center button, and brand surfaces.
 */
export function LoopMark({ size = 96, className = "", animated = true }: Props) {
  const Wrapper = animated ? motion.svg : "svg";
  const wrapperProps = animated
    ? {
        animate: { rotate: [0, 0.6, -0.6, 0] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
      }
    : {};
  return (
    <Wrapper
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...(wrapperProps as object)}
    >
      <defs>
        <linearGradient id="loopGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.24 300)" />
          <stop offset="100%" stopColor="oklch(0.58 0.22 285)" />
        </linearGradient>
        <filter id="loopGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M40 60 C 40 40, 20 40, 20 60 S 40 80, 60 60 S 100 40, 100 60 S 80 80, 60 60"
        stroke="url(#loopGrad)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        filter="url(#loopGlow)"
      />
    </Wrapper>
  );
}
