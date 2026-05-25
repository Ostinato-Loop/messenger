import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Bell, Shield, Info, ChevronRight, LayoutDashboard } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "";

async function checkAdmin(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/config`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const logout = useLogout();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin().then(setIsAdmin);
  }, []);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/auth"); },
    });
  };

  const rows: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void }[] = [
    { icon: <Bell className="w-5 h-5 text-primary" />, label: "Notifications", sub: "Manage alerts", onClick: () => {} },
    { icon: <Shield className="w-5 h-5 text-primary" />, label: "Privacy & Security", sub: "OTP, sessions", onClick: () => {} },
    { icon: <Info className="w-5 h-5 text-primary" />, label: "Terms & Privacy", sub: "Lilcky Studio Limited", onClick: () => setLocation("/terms") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-2xl bg-card border-x border-border min-h-screen">
        <div className="h-16 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-card/90 backdrop-blur z-10">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chats")} data-testid="button-back-settings">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-5">
          {/* Profile card */}
          <button
            type="button"
            className="w-full p-4 bg-muted/30 rounded-2xl flex items-center gap-4 hover:bg-muted/50 transition-colors"
            onClick={() => setLocation("/profile")}
            data-testid="button-goto-profile"
          >
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/20 flex-shrink-0">
              {me?.displayName?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-left">
              <h2 className="font-semibold">{me?.displayName}</h2>
              <p className="text-muted-foreground text-sm">{me?.phone}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Settings rows */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">Preferences</p>
            <div className="bg-muted/20 rounded-2xl overflow-hidden border border-border divide-y divide-border">
              {rows.map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/40 transition-colors text-left"
                  data-testid={`button-settings-${row.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {row.icon}
                  <div className="flex-1">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.sub && <p className="text-xs text-muted-foreground">{row.sub}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Admin Console — only shown to admin users */}
          {isAdmin && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">Admin</p>
              <button
                type="button"
                onClick={() => setLocation("/admin")}
                className="w-full p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4 hover:bg-primary/10 transition-colors text-left"
                data-testid="button-admin-console"
              >
                <LayoutDashboard className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-primary">RALD Admin Console</span>
                  <p className="text-xs text-muted-foreground">Users, OTP, sessions, config</p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary/60" />
              </button>
            </div>
          )}

          {/* App info */}
          <div className="bg-muted/10 rounded-2xl border border-border p-4 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Version</span><span className="font-mono">1.0.0</span></div>
            <div className="flex justify-between"><span>Auth</span><span className="font-mono text-primary">RALD Auth</span></div>
            <div className="flex justify-between"><span>OTP</span><span className="font-mono">TERMII</span></div>
            <div className="flex justify-between"><span>Owner</span><span>Lilcky Studio Limited</span></div>
          </div>

          {/* Sign out */}
          <Button
            variant="destructive"
            className="w-full rounded-2xl h-12"
            onClick={handleLogout}
            disabled={logout.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {logout.isPending ? "Signing out..." : "Sign Out"}
          </Button>

          <p className="text-center text-[10px] text-muted-foreground/40 pb-6">
            © {new Date().getFullYear()} Lilcky Studio Limited. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
