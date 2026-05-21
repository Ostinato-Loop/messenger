import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, PhoneCall, Sparkles, User } from "lucide-react";
import { LoopMark } from "./LoopMark";

type Tab = {
  to: "/updates" | "/calls" | "/chats" | "/profile";
  label: string;
  Icon: typeof MessageCircle;
};

const LEFT: Tab[] = [
  { to: "/updates", label: "Updates", Icon: Sparkles },
  { to: "/calls", label: "Calls", Icon: PhoneCall },
];
const RIGHT: Tab[] = [
  { to: "/chats", label: "Chats", Icon: MessageCircle },
  { to: "/profile", label: "Profile", Icon: User },
];

function TabButton({ tab, active }: { tab: Tab; active: boolean }) {
  const { Icon, label, to } = tab;
  return (
    <Link
      to={to}
      className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium"
    >
      <motion.div
        animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        className="relative"
      >
        {active && (
          <motion.span
            layoutId="nav-active-glow"
            className="absolute inset-0 -m-2 rounded-full bg-primary/20 blur-md"
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          />
        )}
        <Icon
          size={22}
          strokeWidth={active ? 2.3 : 1.7}
          className={active ? "relative text-primary-foreground" : "relative text-muted-foreground"}
          style={active ? { color: "oklch(0.92 0.30 122)" } : undefined}
        />
      </motion.div>
      <span
        className={
          active
            ? "text-foreground/90 tracking-wide"
            : "text-muted-foreground/80 tracking-wide"
        }
      >
        {label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom pointer-events-none">
      <div className="mx-auto mb-3 flex max-w-md items-end px-4 pointer-events-auto">
        <div className="relative flex w-full items-stretch rounded-3xl glass-raised px-2 py-1.5">
          <div className="flex flex-1 items-stretch">
            {LEFT.map((t) => (
              <TabButton key={t.to} tab={t} active={isActive(t.to)} />
            ))}
          </div>

          {/* Center Loop button */}
          <div className="relative flex w-20 items-center justify-center">
            <Link
              to="/loop"
              aria-label="Open Loop"
              className="absolute -top-7 flex h-16 w-16 items-center justify-center rounded-full animate-pulse-glow"
              style={{ background: "var(--gradient-purple)" }}
            >
              <div className="absolute inset-0 rounded-full opacity-60 blur-xl" style={{ background: "var(--gradient-purple)" }} />
              <LoopMark size={36} animated={false} className="relative" />
            </Link>
          </div>

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
