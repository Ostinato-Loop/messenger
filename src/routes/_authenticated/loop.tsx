import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, Infinity as InfinityIcon, Lock, Music4, Radio, Tv, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/loop")({
  component: LoopHub,
  ssr: false,
});

type RoomDef = {
  name: string;
  desc: string;
  icon: React.ElementType;
  status: "live" | "available" | "soon";
  badge: string;
  color: string;
  glow: string;
};

const ROOMS: RoomDef[] = [
  {
    name: "Sports Room",
    desc: "Live match reactions, commentary & scores with your crew",
    icon: Radio,
    status: "available",
    badge: "V1",
    color: "oklch(0.72 0.22 25)",
    glow: "oklch(0.72 0.22 25 / 0.20)",
  },
  {
    name: "Hangout Room",
    desc: "Persistent voice vibe — always on, drop in anytime",
    icon: Music4,
    status: "available",
    badge: "V1",
    color: "oklch(0.72 0.20 145)",
    glow: "oklch(0.72 0.20 145 / 0.20)",
  },
  {
    name: "Event Room",
    desc: "Plan together, countdown & go live on the day",
    icon: CalendarDays,
    status: "available",
    badge: "V1",
    color: "oklch(0.76 0.18 65)",
    glow: "oklch(0.76 0.18 65 / 0.20)",
  },
  {
    name: "Music Room",
    desc: "Listen in perfect sync — same beat, different places",
    icon: Music4,
    status: "soon",
    badge: "V1.5",
    color: "oklch(0.68 0.18 295)",
    glow: "oklch(0.68 0.18 295 / 0.18)",
  },
  {
    name: "Watch Room",
    desc: "Synced video sessions — movie night done right",
    icon: Tv,
    status: "soon",
    badge: "V1.5",
    color: "oklch(0.65 0.18 240)",
    glow: "oklch(0.65 0.18 240 / 0.18)",
  },
];

function LoopHub() {
  const active = ROOMS.filter((r) => r.status !== "soon");
  const coming = ROOMS.filter((r) => r.status === "soon");

  return (
    <div className="flex min-h-screen flex-col pb-32 safe-top">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "oklch(0.76 0.18 65 / 0.15)", border: "1px solid oklch(0.76 0.18 65 / 0.30)" }}
          >
            <div
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, borderRadius: "1rem", background: "oklch(0.76 0.18 65 / 0.15)", filter: "blur(16px)", animation: "breathe 4.5s ease-in-out infinite" }}
            />
            <InfinityIcon size={26} style={{ color: "oklch(0.76 0.18 65)", position: "relative" }} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.30em] text-muted-foreground">The Loop</p>
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              <span className="text-gradient-primary">Rooms</span>
            </h1>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 text-sm text-muted-foreground leading-relaxed"
        >
          Private overlays you attach to any chat or group.
          Pick a Room and bring your conversation to life.
        </motion.p>
        <div className="kente-strip mt-4 w-20" />
      </div>

      {/* Active rooms */}
      <div className="px-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Available now
        </p>
        <div className="flex flex-col gap-3">
          {active.map((r, i) => (
            <RoomCard key={r.name} room={r} index={i} />
          ))}
        </div>
      </div>

      {/* Coming soon */}
      {coming.length > 0 && (
        <div className="px-5 mt-7">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            Coming soon
          </p>
          <div className="flex flex-col gap-3">
            {coming.map((r, i) => (
              <RoomCard key={r.name} room={r} index={active.length + i} disabled />
            ))}
          </div>
        </div>
      )}

      {/* Community hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mx-5 mt-7 flex items-center gap-3 rounded-2xl px-4 py-3.5"
        style={{ background: "oklch(0.76 0.18 65 / 0.08)", border: "1px solid oklch(0.76 0.18 65 / 0.18)" }}
      >
        <Users size={18} style={{ color: "oklch(0.76 0.18 65)", flexShrink: 0 }} />
        <p className="text-xs text-muted-foreground leading-snug">
          Rooms are <strong className="text-foreground/90">private by default</strong> — only your chat members can join.
        </p>
      </motion.div>
    </div>
  );
}

function RoomCard({ room, index, disabled = false }: { room: RoomDef; index: number; disabled?: boolean }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      transition={{ delay: 0.06 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.99]"
      style={{
        background: "oklch(0.17 0.022 50 / 0.85)",
        border: `1px solid ${room.color}33`,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {/* Subtle left glow accent */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%",
          width: 3, borderRadius: "0 2px 2px 0",
          background: room.color,
          boxShadow: `0 0 12px ${room.color}`,
          opacity: disabled ? 0.4 : 0.9,
        }}
      />

      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${room.glow}`, boxShadow: `0 0 20px ${room.glow}` }}
      >
        <room.icon size={22} style={{ color: room.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold truncate">{room.name}</h3>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: disabled ? "oklch(1 0 0 / 8%)" : `${room.glow}`,
              color: disabled ? "oklch(0.60 0.022 55)" : room.color,
              border: `1px solid ${room.color}55`,
            }}
          >
            {room.badge}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">{room.desc}</p>
      </div>

      {disabled ? (
        <Lock size={16} className="text-muted-foreground shrink-0" />
      ) : (
        <div
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-110"
          style={{ background: room.glow, color: room.color }}
        >
          →
        </div>
      )}
    </motion.button>
  );
}
