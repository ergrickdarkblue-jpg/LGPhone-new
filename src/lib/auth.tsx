import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, type Profile } from './supabase';
import type { Lang } from './i18n';
import { getT } from './i18n';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (mounted) setProfile(data as Profile | null);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && mounted) loadProfile(session.user.id);
      else if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else { if (mounted) { setProfile(null); setLoading(false); } }
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (profile) setLoading(false); }, [profile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppState>({} as AppState);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('vi');
  const t = getT(lang);
  return <AppContext.Provider value={{ lang, setLang, t }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
