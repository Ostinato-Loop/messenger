// Loop Messenger — VerifiedBadge
// Blue checkmark badge for RALD-verified users and accounts.
// LILCKY STUDIO LIMITED

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeSize = "xs" | "sm" | "md";

const SIZE_MAP: Record<BadgeSize, { outer: string; icon: string }> = {
  xs: { outer: "w-3 h-3",     icon: "w-1.5 h-1.5" },
  sm: { outer: "w-3.5 h-3.5", icon: "w-2 h-2"     },
  md: { outer: "w-4.5 h-4.5", icon: "w-2.5 h-2.5" },
};

interface VerifiedBadgeProps {
  size?: BadgeSize;
  className?: string;
}

export function VerifiedBadge({ size = "sm", className }: VerifiedBadgeProps) {
  const s = SIZE_MAP[size];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center",
        "bg-blue-500 shadow-sm ring-1 ring-[#070809]",
        s.outer,
        className
      )}
      aria-label="Verified"
    >
      <Check className={cn(s.icon, "text-white stroke-[3]")} />
    </div>
  );
}
