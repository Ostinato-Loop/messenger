import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type MessengerProfile = {
  id: string;
  user_id: string;
  phone: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  onboarding_completed: boolean;
};

type AuthState = {
  hydrated: boolean;
  session: Session | null;
  user: User | null;
  profile: MessengerProfile | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: MessengerProfile | null) => void;
  refreshProfile: () => Promise<MessengerProfile | null>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  hydrated: false,
  session: null,
  user: null,
  profile: null,
  setSession: (session) =>
    set({ session, user: session?.user ?? null, hydrated: true }),
  setProfile: (profile) => set({ profile }),
  refreshProfile: async () => {
    const user = get().user;
    if (!user) return null;
    const { data } = await supabase
      .from("messenger_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    set({ profile: (data as MessengerProfile) ?? null });
    return (data as MessengerProfile) ?? null;
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));

export async function bootstrapAuth() {
  const { data } = await supabase.auth.getSession();
  useAuth.getState().setSession(data.session);
  if (data.session) await useAuth.getState().refreshProfile();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    useAuth.getState().setSession(session);
    if (session) {
      await useAuth.getState().refreshProfile();
    } else {
      useAuth.getState().setProfile(null);
    }
  });
}
