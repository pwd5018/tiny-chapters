import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase";

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session) {
    return null;
  }

  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signUp(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signOut() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}

export function onAuthStateChange(
  callback: (session: Session | null, user: User | null) => void
) {
  const client = getSupabaseClient();

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}
