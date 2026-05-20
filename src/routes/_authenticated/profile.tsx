import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LogOut, Settings, Shield, Bell, ChevronRight, User as UserIcon } from "lucide-react";

import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  ssr: false,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col px-5 pt-12 pb-32 safe-top">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-raised flex items-center gap-4 rounded-3xl p-5"
      >
        <div className="relative h-16 w-16 overflow-hidden rounded-full glow-ring">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface">
              <UserIcon size={24} className="text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{profile?.display_name ?? "—"}</h2>
          <p className="text-sm text-muted-foreground">@{profile?.username ?? ""}</p>
          <p className="mt-1 text-xs text-muted-foreground/80">{user?.phone ?? ""}</p>
        </div>
      </motion.section>

      <div className="neon-divider my-6" />

      <div className="flex flex-col gap-2">
        <Row icon={<Bell size={18} />}     label="Notifications" />
        <Row icon={<Shield size={18} />}   label="Privacy & security" />
        <Row icon={<Settings size={18} />} label="Settings" />
      </div>

      <button
        onClick={handleSignOut}
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl glass py-3.5 text-sm font-medium text-foreground/90 transition hover:text-destructive-foreground hover:bg-destructive/20"
      >
        <LogOut size={16} /> Sign out
      </button>

      <p className="mt-auto pt-10 text-center text-[10px] uppercase tracking-[0.32em] text-muted-foreground/70">
        Loop Messenger · A LILCKY STUDIO product
      </p>
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:glow-ring">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  );
}
