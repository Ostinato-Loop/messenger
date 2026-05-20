import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";

import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  ssr: false,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { hydrated, session, profile } = useAuth();

  useEffect(() => {
    if (!hydrated) return;
    if (!session) navigate({ to: "/login", replace: true });
    else if (!profile?.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [hydrated, session, profile, navigate]);

  if (!hydrated || !session || !profile?.onboarding_completed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-primary/30 blur-xl animate-breathe" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative mx-auto min-h-screen w-full max-w-md"
    >
      <Outlet />
      <BottomNav />
    </motion.div>
  );
}
