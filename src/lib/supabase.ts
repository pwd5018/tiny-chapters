import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export type SupabaseMemoryRow = {
  id: string;
  user_id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type SupabaseMemoryPhotoRefRow = {
  id: string;
  memory_id: string;
  user_id: string;
  photo_id: string;
  source: "nas" | "local" | "mock";
  path: string;
  content_hash: string | null;
  attached_at: string;
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: secureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}
