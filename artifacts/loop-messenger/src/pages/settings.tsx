import React from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Settings as SettingsIcon, Bell, Shield, Moon } from "lucide-react";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-2xl bg-card border-x border-border min-h-screen">
        <div className="h-16 border-b border-border flex items-center px-4 gap-4 sticky top-0 bg-card/80 backdrop-blur z-10">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Settings</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-6">
          <div className="p-4 bg-muted/30 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLocation("/profile")}>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {me?.displayName?.substring(0,2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{me?.displayName}</h2>
              <p className="text-muted-foreground">{me?.phone}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">App Settings</h3>
            <div className="bg-muted/20 rounded-2xl overflow-hidden divide-y divide-border border border-border">
              <div className="p-4 flex items-center gap-4 hover:bg-muted/40 cursor-pointer transition-colors">
                <Bell className="w-5 h-5 text-primary" />
                <span className="flex-1">Notifications</span>
              </div>
              <div className="p-4 flex items-center gap-4 hover:bg-muted/40 cursor-pointer transition-colors">
                <Shield className="w-5 h-5 text-primary" />
                <span className="flex-1">Privacy & Security</span>
              </div>
              <div className="p-4 flex items-center gap-4 hover:bg-muted/40 cursor-pointer transition-colors">
                <Moon className="w-5 h-5 text-primary" />
                <span className="flex-1">Appearance (Dark Mode Only)</span>
              </div>
            </div>
          </div>

          <div className="pt-8 flex justify-center">
            <Button variant="destructive" className="w-full max-w-xs" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="w-4 h-4 mr-2" /> 
              {logout.isPending ? "Logging out..." : "Log Out"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}