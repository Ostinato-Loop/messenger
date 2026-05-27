/**
 * Loop Messenger brand mark
 * Loop Messenger is an independent product — its identity is separate from RALD.
 * This file previously held the RALD logo in error. It now holds the Loop Messenger mark.
 * Brand color: #FF7A00 (vibrant orange)
 */

interface MessengerIconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** The Loop Messenger "L" mark — square aspect ratio */
export function MessengerIcon({ size = 36, color = "#FF7A00", className = "" }: MessengerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className={className}
      aria-label="Loop Messenger"
      role="img"
    >
      <path d="M12 8h4v24h16v4H12V8z" fill={color} opacity="0.95" />
      <path d="M18 14h4v12h10v4H18V14z" fill={color} opacity="0.45" />
    </svg>
  );
}

/** Loop Messenger wordmark */
export function MessengerLogo({ size = 36, color = "#FF7A00", className = "" }: MessengerIconProps) {
  const w = Math.round(size * 4.2);
  return (
    <svg
      width={w}
      height={size}
      viewBox={`0 0 ${w} ${size}`}
      fill="none"
      className={className}
      aria-label="Loop Messenger"
      role="img"
    >
      <g transform={`scale(${size / 44})`}>
        <path d="M12 8h4v24h16v4H12V8z" fill={color} opacity="0.95" />
        <path d="M18 14h4v12h10v4H18V14z" fill={color} opacity="0.45" />
      </g>
      <text
        x={size + Math.round(size * 0.25)}
        y={Math.round(size * 0.74)}
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontWeight="700"
        fontSize={Math.round(size * 0.70)}
        fill={color}
        letterSpacing="-0.02em"
      >
        Messenger
      </text>
    </svg>
  );
}

/** @deprecated RALD logo was incorrectly placed in Loop Messenger. Use MessengerLogo or MessengerIcon. */
export const RaldLogo = MessengerLogo;
