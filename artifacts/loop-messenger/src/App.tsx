import React, { lazy, Suspense, useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";
import { SplashScreen } from "@/components/splash";
import { CallProvider } from "@/lib/call-provider";
import { InCallView } from "@/components/in-call-view";
import { IncomingCallModal } from "@/components/incoming-call-modal";
import { OfflineBanner } from "@/components/skeleton-loaders";
import { useIsOffline } from "@/lib/network";
import { initPushNotifications } from "@/lib/notification.service";

// Lazy-loaded pages — code split for 3G/4G optimization
const AuthPage        = lazy(() => import("@/pages/auth"));
const OnboardingPage  = lazy(() => import("@/pages/onboarding"));
const ChatsPage       = lazy(() => import("@/pages/chats"));
const ProfilePage     = lazy(() => import("@/pages/profile"));
const SettingsPage    = lazy(() => import("@/pages/settings"));
const TermsPage       = lazy(() => import("@/pages/terms"));
const AdminPage       = lazy(() => import("@/pages/admin"));
const NotFound        = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function RootRedirect() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } as any });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      setLocation(user ? "/chats" : "/auth");
    }
  }, [user, isLoading, setLocation]);

  return <PageLoader />;
}

function AppRoutes() {
  return (
    <div className="dark min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/"                      component={RootRedirect} />
          <Route path="/auth"                  component={AuthPage} />
          <Route path="/onboarding"            component={OnboardingPage} />
          <Route path="/chats"                 component={ChatsPage} />
          <Route path="/chats/:conversationId" component={ChatsPage} />
          <Route path="/profile"               component={ProfilePage} />
          <Route path="/settings"              component={SettingsPage} />
          <Route path="/terms"                 component={TermsPage} />
          <Route path="/admin"                 component={AdminPage} />
          <Route                               component={NotFound} />
        </Switch>
      </Suspense>
    </div>
  );
}

/** Inner app — has access to QueryClient, so can call useGetMe for CallProvider */
function AuthenticatedShell({ splashDone, onSplashDone }: { splashDone: boolean; onSplashDone: () => void }) {
  const { data: me } = useGetMe({ query: { retry: false, staleTime: 60_000 } as any });
  const isOffline = useIsOffline();

  // Init Web Push once the user is authenticated
  useEffect(() => {
    if (!me) return;
    // Defer until after first paint to avoid blocking the UI thread
    const tid = setTimeout(() => {
      initPushNotifications().catch(() => {});
    }, 2000);
    return () => clearTimeout(tid);
  }, [me]);

  return (
    <CallProvider me={me as any}>
      {isOffline && <OfflineBanner />}
      <IncomingCallModal />
      <InCallView />
      {!splashDone && <SplashScreen onDone={onSplashDone} />}
      <AppRoutes />
    </CallProvider>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");

    // Register service worker (v3 — adds push notification support)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => { /* SW registration is best-effort */ });
    }

    // Listen for incoming_call_tap from service worker (background notification click)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "incoming_call_tap" && event.data.url) {
          window.location.href = event.data.url;
        }
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthenticatedShell splashDone={splashDone} onSplashDone={() => setSplashDone(true)} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
