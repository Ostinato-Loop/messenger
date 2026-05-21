import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="z-10 text-center space-y-6 max-w-sm"
      >
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-[22px] bg-muted border border-border flex items-center justify-center shadow-[0_0_32px_rgba(255,107,0,0.15)]">
            <AlertCircle className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">404</h1>
          <p className="text-lg font-semibold text-foreground">Page not found</p>
          <p className="text-sm text-muted-foreground">
            This route doesn't exist in Loop Messenger.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setLocation("/chats")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:bg-primary/90 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Chats
        </button>

        <p className="text-[10px] text-muted-foreground/40">Loop Messenger · Lilcky Studio Limited</p>
      </motion.div>
    </div>
  );
}
