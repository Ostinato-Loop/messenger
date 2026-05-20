import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  hint?: string;
};

export function ComingSoonPanel({ title, subtitle, icon, hint }: Props) {
  return (
    <div className="flex min-h-screen flex-col px-5 pt-14 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-auto mb-auto flex flex-col items-center justify-center text-center"
      >
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl glass-raised">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-primary/15 blur-2xl animate-breathe" />
          <div className="text-primary-foreground" style={{ color: "oklch(0.78 0.18 300)" }}>
            {icon}
          </div>
        </div>
        <h2 className="text-xl font-medium">Setting the stage</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          {hint ??
            "This surface is part of the Loop Messenger foundation. The full experience activates as backend services come online."}
        </p>
      </motion.div>
    </div>
  );
}
