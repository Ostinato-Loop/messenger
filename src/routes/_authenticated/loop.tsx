import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Infinity as InfinityIcon, Radio, Tv, CalendarDays, Music4 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/loop")({
  component: LoopHub,
  ssr: false,
});

const ROOM_TYPES = [
  { name: "Sports Room", desc: "Match night, live reactions", icon: Radio, status: "V1", active: true },
  { name: "Hangout Room", desc: "Persistent voice vibe",       icon: Music4, status: "V1", active: true },
  { name: "Event Room",   desc: "Plan and live together",      icon: CalendarDays, status: "V1", active: true },
  { name: "Music Room",   desc: "Listen together in sync",     icon: Music4, status: "V1.5", active: false },
  { name: "Watch Room",   desc: "Synced video sessions",       icon: Tv, status: "V1.5", active: false },
];

function LoopHub() {
  return (
    <div className="flex min-h-screen flex-col px-5 pt-12 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl glass-raised">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-primary/25 blur-xl animate-breathe" />
          <InfinityIcon size={26} style={{ color: "oklch(0.78 0.18 300)" }} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">The Loop</p>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
        </div>
      </motion.header>

      <p className="mb-6 text-sm text-muted-foreground">
        Private overlays you can attach to any chat or group. Activate a Room to bring your conversation to life.
      </p>

      <div className="flex flex-col gap-3">
        {ROOM_TYPES.map((r, i) => (
          <motion.button
            key={r.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            disabled={!r.active}
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl glass-raised px-4 py-4 text-left transition-all hover:translate-y-[-1px] hover:glow-ring disabled:opacity-60"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
              <r.icon size={20} style={{ color: "oklch(0.78 0.18 300)" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium">{r.name}</h3>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">
                  {r.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
