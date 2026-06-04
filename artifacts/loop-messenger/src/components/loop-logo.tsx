// Loop Messenger — LoopLogo
// Brand mark used in the Messenger sidebar header and loading screens.
// LILCKY STUDIO LIMITED

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoopLogoProps {
  compact?: boolean;
  className?: string;
}

export function LoopLogo({ compact = false, className }: LoopLogoProps) {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      {/* Amber→orange icon mark */}
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-[0_0_14px_rgba(251,191,36,0.35)] flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-white" strokeWidth={2.5} />
      </div>

      {!compact && (
        <span
          className="font-bold text-[15px] tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
          aria-label="Loop Messenger"
        >
          Messenger
        </span>
      )}
    </div>
  );
}
