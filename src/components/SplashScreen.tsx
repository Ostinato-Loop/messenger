import { motion } from "framer-motion";
import { LoopMark } from "./LoopMark";

export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      {/* ambient breathing aura */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[60vmin] w-[60vmin] rounded-full bg-primary/30 animate-breathe" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <LoopMark size={132} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="flex flex-col items-center gap-2"
        >
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-gradient-purple">Loop</span>{" "}
            <span className="text-foreground/90">Messenger</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            A new way to stay connected
          </p>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="absolute bottom-10 text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70"
      >
        A LILCKY STUDIO product
      </motion.p>
    </motion.div>
  );
}
