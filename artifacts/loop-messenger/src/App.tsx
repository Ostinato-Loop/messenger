import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe } from "@workspace/api-client-react";

import AuthPage from "@/pages/auth";
import OnboardingPage from "@/pages/onboarding";
import ChatsPage from "@/pages/chats";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function RootRedirect() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading) {
      if (user) {
        setLocation("/chats");
      } else {
        setLocation("/auth");
      }
    }
  }, [user, isLoading, setLocation]);

  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
}

function Router() {
  const ProfilePage = () => <div className="min-h-screen flex items-center justify-center bg-background text-primary text-2xl font-bold">Profile Page Scaffold</div>;
  const SettingsPage = () => <div className="min-h-screen flex items-center justify-center bg-background text-primary text-2xl font-bold">Settings Page Scaffold</div>;

  return (
    <div className="dark min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Switch>
        <Route path="/" component={RootRedirect} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/chats" component={ChatsPage} />
        <Route path="/chats/:conversationId" component={ChatsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  React.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;