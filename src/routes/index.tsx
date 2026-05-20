import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";

import { SplashScreen } from "@/components/SplashScreen";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  component: Entry,
  ssr: false,
});

function Entry() {
  const navigate = useNavigate();
  const { hydrated, session, profile } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (showSplash || !hydrated) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
    } else if (!profile?.onboarding_completed) {
      navigate({ to: "/onboarding", replace: true });
    } else {
      navigate({ to: "/chats", replace: true });
    }
  }, [showSplash, hydrated, session, profile, navigate]);

  return (
    <AnimatePresence>
      {showSplash && <SplashScreen key="splash" />}
    </AnimatePresence>
  );
}
