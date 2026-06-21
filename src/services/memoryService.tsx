import { createContext, ReactNode, useContext, useMemo } from "react";

import { prompts } from "@/data/prompts";
import {
  getSupabaseClient,
  type SupabaseMemoryPhotoRefRow,
  type SupabaseMemoryRow,
} from "@/lib/supabase";
import { getCurrentUser } from "@/services/auth/authService";
import type { CreateMemoryInput, Memory } from "@/types/memory";

type MemoryRepository = {
  getMemories: () => Promise<Memory[]>;
  getMemoryById: (id: string) => Promise<Memory | null>;
  createMemory: (input: CreateMemoryInput) => Promise<Memory>;
  searchMemories: (query: string) => Promise<Memory[]>;
  getDailyPrompt: (date?: Date) => string;
};

const MemoryServiceContext = createContext<MemoryRepository | null>(null);

function sortMemories(memories: Memory[]) {
  return [...memories].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function mapDateStringToIso(date: string) {
  return new Date(`${date}T12:00:00.000Z`).toISOString();
}

function mapMemoryRow(
  row: SupabaseMemoryRow,
  photoRefs: SupabaseMemoryPhotoRefRow[]
): Memory {
  return {
    id: row.id,
    date: mapDateStringToIso(row.date),
    prompt: row.prompt,
    text: row.text,
    tags: row.tags ?? [],
    attachedPhotos: photoRefs.map((photoRef) => ({
      photoId: photoRef.photo_id,
      source: photoRef.source,
      path: photoRef.path,
      attachedAt: photoRef.attached_at,
      contentHash: photoRef.content_hash ?? undefined,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserIdOrThrow() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to access memories.");
  }

  return user.id;
}

async function fetchPhotoRefsByMemoryIds(memoryIds: string[]) {
  if (!memoryIds.length) {
    return new Map<string, SupabaseMemoryPhotoRefRow[]>();
  }

  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_photo_refs")
    .select("id, memory_id, user_id, photo_id, source, path, content_hash, attached_at")
    .eq("user_id", userId)
    .in("memory_id", memoryIds)
    .order("attached_at", { ascending: true });

  if (error) {
    throw error;
  }

  const refsByMemoryId = new Map<string, SupabaseMemoryPhotoRefRow[]>();
  for (const row of (data ?? []) as SupabaseMemoryPhotoRefRow[]) {
    const current = refsByMemoryId.get(row.memory_id) ?? [];
    current.push(row);
    refsByMemoryId.set(row.memory_id, current);
  }

  return refsByMemoryId;
}

async function loadMemoriesFromRows(rows: SupabaseMemoryRow[]) {
  const refsByMemoryId = await fetchPhotoRefsByMemoryIds(rows.map((row) => row.id));
  return sortMemories(
    rows.map((row) => mapMemoryRow(row, refsByMemoryId.get(row.id) ?? []))
  );
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const getMemories = async () => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memories")
      .select("id, user_id, date, prompt, text, tags, created_at, updated_at")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return loadMemoriesFromRows((data ?? []) as SupabaseMemoryRow[]);
  };

  const getMemoryById = async (id: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memories")
      .select("id, user_id, date, prompt, text, tags, created_at, updated_at")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const refsByMemoryId = await fetchPhotoRefsByMemoryIds([data.id]);
    return mapMemoryRow(data as SupabaseMemoryRow, refsByMemoryId.get(data.id) ?? []);
  };

  const createMemory = async (input: CreateMemoryInput) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: userId,
        date: input.date.slice(0, 10),
        prompt: input.prompt,
        text: input.text,
        tags: input.tags,
      })
      .select("id, user_id, date, prompt, text, tags, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    if (input.attachedPhotos.length) {
      const { error: photoRefError } = await supabase.from("memory_photo_refs").insert(
        input.attachedPhotos.map((photo) => ({
          memory_id: data.id,
          user_id: userId,
          photo_id: photo.photoId,
          source: photo.source,
          path: photo.path,
          content_hash: photo.contentHash ?? null,
          attached_at: photo.attachedAt,
        }))
      );

      if (photoRefError) {
        throw photoRefError;
      }
    }

    const memory = await getMemoryById(data.id);
    if (!memory) {
      throw new Error("Memory was created but could not be reloaded.");
    }

    return memory;
  };

  const searchMemories = async (query: string) => {
    const allMemories = await getMemories();
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return allMemories;
    }

    return allMemories.filter((memory) => {
      const searchableParts = [
        memory.date,
        memory.prompt,
        memory.text,
        memory.tags.join(" "),
        memory.attachedPhotos.map((photo) => `${photo.photoId} ${photo.path}`).join(" "),
      ];

      return searchableParts.some((part) =>
        normalizeSearchValue(part).includes(normalizedQuery)
      );
    });
  };

  const getDailyPrompt = (date = new Date()) => {
    const dayKey = date.toISOString().slice(0, 10).replaceAll("-", "");
    const promptIndex = Number(dayKey) % prompts.length;
    return prompts[promptIndex];
  };

  const value = useMemo<MemoryRepository>(
    () => ({
      getMemories,
      getMemoryById,
      createMemory,
      searchMemories,
      getDailyPrompt,
    }),
    []
  );

  return (
    <MemoryServiceContext.Provider value={value}>
      {children}
    </MemoryServiceContext.Provider>
  );
}

export function useMemoryService() {
  const context = useContext(MemoryServiceContext);

  if (!context) {
    throw new Error("useMemoryService must be used inside MemoryProvider");
  }

  return context;
}
