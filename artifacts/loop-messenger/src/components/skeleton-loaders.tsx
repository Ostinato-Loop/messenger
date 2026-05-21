import React from "react";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-muted/40 rounded-lg ${className}`}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}

/** Skeleton for a single conversation list item */
export function SkeletonConversation() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Shimmer className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <Shimmer className="h-3.5 w-28 rounded" />
          <Shimmer className="h-3 w-10 rounded" />
        </div>
        <Shimmer className="h-3 w-48 rounded" />
      </div>
    </div>
  );
}

/** Skeleton list of conversations */
export function SkeletonConversationList({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonConversation key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a single chat message bubble */
export function SkeletonMessage({ isMe = false }: { isMe?: boolean }) {
  const widths = ["w-40", "w-56", "w-32", "w-48", "w-36"];
  const w = widths[Math.floor(Math.random() * widths.length)];
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
      {!isMe && <Shimmer className="w-8 h-8 rounded-full mr-2 flex-shrink-0 self-end" />}
      <Shimmer className={`h-10 ${w} rounded-2xl`} />
    </div>
  );
}

/** Skeleton for the full message thread */
export function SkeletonMessageList() {
  const pattern = [false, false, true, false, true, true, false, false, true];
  return (
    <div className="flex flex-col gap-2 p-4">
      {pattern.map((isMe, i) => (
        <SkeletonMessage key={i} isMe={isMe} />
      ))}
    </div>
  );
}

/** Inline spinner */
export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full border-2 border-primary border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading..."
    />
  );
}

/** Offline banner */
export function OfflineBanner() {
  return (
    <div className="bg-destructive/90 text-white text-xs text-center py-1.5 px-4 font-medium">
      📶 No connection — messages will sync when you're back online
    </div>
  );
}

/** Network quality badge */
export function NetworkBadge({ quality }: { quality: string }) {
  if (quality === "wifi" || quality === "5g" || quality === "4g") return null;
  const labels: Record<string, string> = {
    "3g": "3G",
    "2g": "2G",
    offline: "Offline",
  };
  const colors: Record<string, string> = {
    "3g": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "2g": "bg-orange-500/20 text-orange-400 border-orange-500/30",
    offline: "bg-destructive/20 text-destructive border-destructive/30",
  };
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors[quality] ?? ""}`}>
      {labels[quality] ?? quality.toUpperCase()}
    </span>
  );
}
