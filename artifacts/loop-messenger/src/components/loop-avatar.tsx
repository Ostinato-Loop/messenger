// Loop Messenger — LoopAvatar
// Enhanced avatar with online indicator, verified badge, and group icon overlay.
// Drop-in replacement for the plain <Avatar> throughout the Messenger UI.
// LILCKY STUDIO LIMITED

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/verified-badge";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface LoopAvatarProps {
  src?:        string | null;
  name?:       string | null;
  size?:       AvatarSize;
  isOnline?:   boolean;
  isGroup?:    boolean;
  isVerified?: boolean;
  className?:  string;
}

const SIZE_CONFIG: Record<AvatarSize, {
  avatar:    string;
  dot:       string;
  dotBorder: string;
  badge:     "xs" | "sm";
}> = {
  sm: { avatar: "w-8 h-8",   dot: "w-2 h-2",     dotBorder: "border",   badge: "xs" },
  md: { avatar: "w-11 h-11", dot: "w-2.5 h-2.5", dotBorder: "border-2", badge: "xs" },
  lg: { avatar: "w-13 h-13", dot: "w-3 h-3",     dotBorder: "border-2", badge: "sm" },
  xl: { avatar: "w-16 h-16", dot: "w-3.5 h-3.5", dotBorder: "border-2", badge: "sm" },
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function LoopAvatar({
  src,
  name,
  size = "md",
  isOnline,
  isGroup,
  isVerified,
  className,
}: LoopAvatarProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <Avatar className={cn(cfg.avatar, "border border-white/10")}>
        <AvatarImage src={src ?? ""} alt={name ?? ""} />
        <AvatarFallback className="bg-gradient-to-br from-amber-500/25 to-orange-600/25 text-amber-300 font-semibold text-xs">
          {isGroup ? (
            <Users className="w-4 h-4 opacity-80" />
          ) : (
            initials(name)
          )}
        </AvatarFallback>
      </Avatar>

      {/* Online presence dot */}
      {isOnline && !isGroup && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-emerald-500",
            "ring-[#070809] ring-2",
            cfg.dot
          )}
          aria-label="Online"
        />
      )}

      {/* Group badge */}
      {isGroup && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary/80 rounded-full flex items-center justify-center ring-1 ring-[#070809]">
          <Users className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Verified badge — only for non-group avatars */}
      {isVerified && !isGroup && (
        <span className="absolute -top-0.5 -right-0.5">
          <VerifiedBadge size={cfg.badge} />
        </span>
      )}
    </div>
  );
}
