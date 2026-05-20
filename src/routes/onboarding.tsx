import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Camera, User as UserIcon, ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  ssr: false,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, hydrated, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (profile?.onboarding_completed) navigate({ to: "/chats", replace: true });
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [hydrated, user, profile, navigate]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(u)) {
      toast.error("Username: 3–24 chars, a–z, 0–9, _ or .");
      return;
    }
    if (!displayName.trim()) { toast.error("Add a display name"); return; }

    setSaving(true);
    const { error } = await supabase
      .from("messenger_profiles")
      .update({
        username: u,
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("That username is taken");
      else toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("You're in");
    navigate({ to: "/chats", replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col px-6 py-10 safe-top safe-bottom">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-[50vmin] w-[50vmin] rounded-full bg-primary/20 blur-3xl animate-breathe" />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-4"
      >
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Step 01 — Identity</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Let's set up <span className="text-gradient-purple">your Loop</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your handle is how friends find you. You can change it later.
        </p>
      </motion.header>

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={save}
        className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-28 w-28 overflow-hidden rounded-full glass-raised glow-ring transition-transform hover:scale-[1.03]"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserIcon size={36} className="text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/40 py-1.5 text-[10px] uppercase tracking-widest text-foreground/90 backdrop-blur">
              <Camera size={12} /> {uploading ? "Uploading…" : avatarUrl ? "Change" : "Add"}
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <label className="glass-raised flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:glow-ring transition-all">
          <span className="text-sm text-muted-foreground">@</span>
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="flex-1 bg-transparent text-base outline-none"
          />
        </label>

        <label className="glass-raised flex items-center gap-3 rounded-2xl px-4 py-3.5 focus-within:glow-ring transition-all">
          <UserIcon size={16} className="text-muted-foreground" />
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="group mt-2 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--gradient-purple)", boxShadow: "var(--shadow-glow)" }}
        >
          {saving ? "Setting up…" : "Enter Loop"}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </motion.form>
    </div>
  );
}
