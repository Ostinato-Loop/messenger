import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bell, ChevronRight, HelpCircle, LogOut, Settings, Shield, User as UserIcon, Camera } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  ssr: false,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login", replace: true });
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("messenger-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("messenger-avatars").getPublicUrl(path);
    await supabase
      .from("messenger_profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("user_id", user.id);
    await refreshProfile();
    setUploading(false);
    toast.success("Photo updated");
    e.target.value = "";
  }

  const MENU_GROUPS = [
    {
      label: "Preferences",
      items: [
        { icon: Bell,     label: "Notifications",     sub: "Manage alerts & sounds" },
        { icon: Shield,   label: "Privacy & Security", sub: "Control who sees what" },
        { icon: Settings, label: "Settings",           sub: "App preferences"        },
      ],
    },
    {
      label: "Support",
      items: [
        { icon: HelpCircle, label: "Help & Feedback", sub: "Report an issue or ask a question" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col pb-32 safe-top">
      {/* Hero band */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 220,
          background: "linear-gradient(180deg, oklch(0.76 0.18 65 / 0.14) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <div className="relative px-5 pt-14 pb-6">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-[11px] uppercase tracking-[0.30em] text-muted-foreground"
        >
          My Profile
        </motion.h1>

        {/* Avatar + info card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="relative overflow-hidden rounded-3xl p-5"
          style={{ background: "oklch(0.17 0.022 50 / 0.9)", border: "1px solid oklch(1 0 0 / 9%)" }}
        >
          {/* Kente strip at top */}
          <div className="kente-strip absolute top-0 left-0 right-0 rounded-t-3xl" style={{ height: 3, borderRadius: "1.5rem 1.5rem 0 0" }} />

          <div className="flex items-center gap-4 pt-1">
            {/* Avatar */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl transition active:scale-95"
              style={{ boxShadow: "0 0 0 3px oklch(0.76 0.18 65 / 0.60), 0 0 20px oklch(0.76 0.18 65 / 0.30)" }}
              aria-label="Change avatar"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ background: "oklch(0.76 0.18 65 / 0.15)" }}>
                  <UserIcon size={28} style={{ color: "oklch(0.76 0.18 65)" }} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: "oklch(0 0 0 / 0.5)", color: "oklch(0.97 0.008 65)", backdropFilter: "blur(4px)" }}>
                <Camera size={10} />{uploading ? "…" : "Edit"}
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />

            {/* Name & details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate">
                {profile?.display_name ?? "—"}
              </h2>
              <p className="text-sm truncate" style={{ color: "oklch(0.76 0.18 65)" }}>
                @{profile?.username ?? ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{user?.phone ?? ""}</p>

              <Link
                to="/onboarding"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition active:scale-95"
                style={{ background: "oklch(0.76 0.18 65 / 0.14)", color: "oklch(0.76 0.18 65)", height: 30 }}
              >
                Edit profile
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Menu groups */}
      <div className="flex-1 px-5 flex flex-col gap-5">
        {MENU_GROUPS.map((group, gi) => (
          <motion.div
            key={group.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + gi * 0.04 }}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground px-1">
              {group.label}
            </p>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition active:scale-[0.99]"
                  style={{ background: "oklch(0.17 0.022 50 / 0.8)", border: "1px solid oklch(1 0 0 / 8%)" }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "oklch(0.76 0.18 65 / 0.13)" }}
                  >
                    <item.icon size={18} style={{ color: "oklch(0.76 0.18 65)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Sign out */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-semibold transition active:scale-[0.99]"
          style={{ background: "oklch(0.62 0.22 25 / 0.10)", border: "1px solid oklch(0.62 0.22 25 / 0.25)", color: "oklch(0.72 0.20 25)" }}
        >
          <LogOut size={16} /> Sign out
        </motion.button>
      </div>

      <p className="py-8 text-center text-[10px] uppercase tracking-[0.34em] text-muted-foreground/60">
        Loop Messenger · LILCKY STUDIO · v2.0
      </p>
    </div>
  );
}
