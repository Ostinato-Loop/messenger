// Loop Messenger — MobileShell
// Full-screen, safe-area-aware wrapper for the mobile-first Messenger UI.
// Handles iOS notch / Android status-bar via CSS env() variables.
// LILCKY STUDIO LIMITED

import React from "react";
import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * MobileShell wraps the entire Messenger in a full-height, safe-area-aware
 * container.  Use 100dvh (dynamic viewport height) so the shell never extends
 * behind the browser address bar on mobile Safari / Chrome.
 *
 * Slots:
 *   header  — rendered above the scrollable content, inside the safe area
 *   footer  — rendered below, inside the safe area (e.g. bottom nav)
 *   children — fills the remaining flex space, overflow-hidden so inner
 *               scroll areas work correctly on iOS
 */
export function MobileShell({ children, header, footer, className }: MobileShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-[#070809] text-foreground overflow-hidden",
        "h-[100dvh]",
        className
      )}
      style={{
        paddingTop:    "env(safe-area-inset-top,    0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft:   "env(safe-area-inset-left,   0px)",
        paddingRight:  "env(safe-area-inset-right,  0px)",
      }}
    >
      {header && <div className="flex-shrink-0 z-20">{header}</div>}

      <div className="flex-1 overflow-hidden relative min-h-0">
        {children}
      </div>

      {footer && <div className="flex-shrink-0 z-20">{footer}</div>}
    </div>
  );
}
