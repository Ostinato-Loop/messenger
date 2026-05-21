import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: MessengerProfile | null;
  hydrated: boolean;
  refreshProfile: () => Promise<MessengerProfile | null>;
  setProfile: (p: MessengerProfile | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, hydrated: false,
  refreshProfile: async () => null,
  setProfile: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MessengerProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  async function refreshProfile(userId?: string): Promise<MessengerProfile | null> {
    const uid = userId ?? session?.user?.id;
    if (!uid) return null;
    const { data } = await supabase
      .from('messenger_profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    setProfile((data as MessengerProfile) ?? null);
    return (data as MessengerProfile) ?? null;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) refreshProfile(data.session.user.id);
      setHydrated(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        await refreshProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, profile,
      hydrated, refreshProfile: () => refreshProfile(), setProfile, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
