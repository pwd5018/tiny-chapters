import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getCurrentSession,
  getCurrentUser,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from "@/services/auth/authService";

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (email: string, password: string) => Promise<User | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isActive = true;

    async function loadAuthState() {
      try {
        const [nextSession, nextUser] = await Promise.all([
          getCurrentSession(),
          getCurrentUser(),
        ]);

        if (isActive) {
          setSession(nextSession);
          setUser(nextUser);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAuthState();

    const unsubscribe = onAuthStateChange((nextSession, nextUser) => {
      if (isActive) {
        setSession(nextSession);
        setUser(nextUser);
        setIsLoading(false);
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user,
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
