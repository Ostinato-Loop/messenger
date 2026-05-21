import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, PhoneCall, Sparkles, User } from "lucide-react";
import { LoopMark } from "./LoopMark";

type Tab = {
  to: "/updates" | "/calls" | "/chats" | "/profile";
  label: string;
  Icon: typeof MessageCircle;
};

const LEFT: Tab[]  = [
  { to: "/updates", label: "Updates", Icon: Sparkles   },
  { to: "/calls",   label: "Calls",   Icon: PhoneCall  },
];
const RIGHT: Tab[] = [
  { to: "/chats",   label: "Chats",   Icon: MessageCircle },
  { to: "/profile", label: "Profile", Icon: User          },
];

function TabButton({ tab, active }: { tab: Tab; active: boolean }) {
  const { Icon, label, to } = tab;
  return (
    <Link
      to={to}
      className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
      style={{ color: active ? "oklch(0.76 0.18 65)" : "oklch(0.55 0.018 55)" }}
    >
      <motion.div
        animate={{ scale: active ? 1.10 : 1, y: active ? -1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="relative"
      >
        {active && (
          <motion.span
            layoutId="tab-active-bg"
            className="absolute inset-0 -m-2 rounded-full"
            style={{ background: "oklch(0.76 0.18 65 / 0.16)", filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          />
        )}
        <Icon
          size={21}
          strokeWidth={active ? 2.4 : 1.8}
          style={{ position: "relative", color: active ? "oklch(0.76 0.18 65)" : "oklch(0.55 0.018 55)" }}
        />
      </motion.div>
      <span style={{ letterSpacing: "0.04em" }}>{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const loopActive = isActive("/loop");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom pointer-events-none">
      <div className="mx-auto mb-3 flex max-w-md items-end px-4 pointer-events-auto">
        <div
          className="relative flex w-full items-stretch px-1 py-1.5"
          style={{
            borderRadius: "1.5rem",
            background: "color-mix(in oklab, oklch(0.17 0.022 50) 85%, transparent)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid oklch(1 0 0 / 10%)",
            boxShadow: "0 8px 32px -8px oklch(0.08 0.01 45 / 0.65)",
          }}
        >
          {/* Kente strip at top of nav */}
          <div className="kente-strip absolute top-0 left-6 right-6" style={{ height: 2, borderRadius: 999 }} />

          {/* Left tabs */}
          <div className="flex flex-1 items-stretch">
            {LEFT.map((t) => (
              <TabButton key={t.to} tab={t} active={isActive(t.to)} />
            ))}
          </div>

          {/* Center Loop button */}
          <div className="relative flex w-[72px] items-center justify-center">
            <Link
              to="/loop"
              aria-label="Open Loop Rooms"
              className="absolute -top-8 flex h-[60px] w-[60px] flex-col items-center justify-center rounded-full transition active:scale-95"
              style={{
                background: loopActive
                  ? "var(--gradient-primary)"
                  : "linear-gradient(135deg, oklch(0.20 0.025 50), oklch(0.26 0.030 55))",
                border: loopActive
                  ? "none"
                  : "1px solid oklch(0.76 0.18 65 / 0.30)",
                boxShadow: loopActive
                  ? "var(--shadow-glow), 0 0 0 3px oklch(0.76 0.18 65 / 0.20)"
                  : "0 4px 20px -4px oklch(0.08 0.01 45 / 0.8)",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "oklch(0.76 0.18 65 / 0.22)",
                  filter: "blur(12px)",
                  animation: "breathe 4.5s ease-in-out infinite",
                }}
              />
              <LoopMark
                size={30}
                className="relative"
                style={{ color: loopActive ? "oklch(0.09 0.01 45)" : "oklch(0.76 0.18 65)" }}
              />
            </Link>
            <span
              className="absolute bottom-1 text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: loopActive ? "oklch(0.76 0.18 65)" : "oklch(0.50 0.015 55)", letterSpacing: "0.08em" }}
            >
              Loop
            </span>
          </div>

          {/* Right tabs */}
          <div className="flex flex-1 items-stretch">
            {RIGHT.map((t) => (
              <TabButton key={t.to} tab={t} active={isActive(t.to)} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
