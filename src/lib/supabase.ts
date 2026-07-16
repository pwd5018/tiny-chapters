import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/config/appConfig";
import type {
  AttachedMediaKind,
  MemoryCollectionKind,
  MemoryGuidanceContext,
  MemoryImportance,
  MemoryLifecycleStatus,
  MemoryEntityKind,
  MemoryMetadataSuggestionField,
  MemoryMetadataSuggestionStatus,
} from "@/types/memory";

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
  guided_context: MemoryGuidanceContext | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseMemoryMetadataRow = {
  memory_id: string;
  user_id: string;
  lifecycle_status: MemoryLifecycleStatus;
  is_favorite: boolean;
  importance: MemoryImportance | null;
  people: string[];
  places: string[];
  projects: string[];
  topics: string[];
  created_at: string;
  updated_at: string;
};

export type SupabaseMemoryMetadataSuggestionRow = {
  id: string;
  memory_id: string;
  user_id: string;
  field: MemoryMetadataSuggestionField;
  value: string;
  matched_value: string | null;
  confidence: number;
  status: MemoryMetadataSuggestionStatus;
  provider: string | null;
  model: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type SupabaseMemoryEntityRow = {
  id: string;
  user_id: string;
  kind: MemoryEntityKind;
  canonical_name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
};

export type SupabaseMemoryEntityAliasRow = {
  id: string;
  entity_id: string;
  user_id: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
};

export type SupabaseMemoryCollectionRow = {
  id: string;
  user_id: string;
  title: string;
  kind: MemoryCollectionKind;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseMemoryCollectionMembershipRow = {
  id: string;
  collection_id: string;
  memory_id: string;
  user_id: string;
  added_at: string;
};

export type SupabaseMemoryPhotoRefRow = {
  id: string;
  memory_id: string;
  user_id: string;
  photo_id: string;
  media_kind: AttachedMediaKind | null;
  source: "nas" | "local" | "mock";
  path: string;
  content_hash: string | null;
  attached_at: string;
  filename: string | null;
  taken_at: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  mime_type: string | null;
  local_uri: string | null;
  poster_path: string | null;
  poster_local_uri: string | null;
  sync_status: string | null;
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
