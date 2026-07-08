import { createContext, ReactNode, useContext, useMemo } from "react";

import { prompts } from "@/data/prompts";
import { addLocalDays, parseDateKeyAsLocalDate, toLocalDateKey } from "@/lib/dates";
import {
  getSupabaseClient,
  type SupabaseMemoryPhotoRefRow,
  type SupabaseMemoryRow,
} from "@/lib/supabase";
import { getCurrentUser } from "@/services/auth/authService";
import { normalizeAttachedPhotoSyncStatus } from "@/services/photo/photoDurability";
import type { CreateMemoryInput, Memory } from "@/types/memory";

type MemoryStats = {
  totalMemories: number;
  totalPhotoRefs: number;
  thisMonthMemories: number;
  currentStreak: number;
};

type MemoryRepository = {
  getMemories: () => Promise<Memory[]>;
  getOnThisDayMemories: (date: Date, options?: { limit?: number }) => Promise<Memory[]>;
  getMemoryStats: (date?: Date) => Promise<MemoryStats>;
  getMemoryById: (id: string) => Promise<Memory | null>;
  createMemory: (input: CreateMemoryInput) => Promise<Memory>;
  updateMemory: (id: string, input: Omit<CreateMemoryInput, "attachedPhotos">) => Promise<Memory>;
  deleteMemory: (id: string) => Promise<void>;
  updateMemoryPhotoRefs: (memoryId: string, attachedPhotos: Memory["attachedPhotos"]) => Promise<void>;
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

function toMonthDayKey(isoString: string) {
  return isoString.slice(5, 10);
}

function toDateKey(isoString: string) {
  return isoString.slice(0, 10);
}

function getCurrentStreak(memories: Memory[], today: Date) {
  const distinctDateKeys = [...new Set(memories.map((memory) => toDateKey(memory.date)))];

  if (!distinctDateKeys.length) {
    return 0;
  }

  const latestDate = distinctDateKeys[0];
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = toLocalDateKey(addLocalDays(today, -1));

  if (latestDate !== todayKey && latestDate !== yesterdayKey) {
    return 0;
  }

  let streak = 0;
  let cursor = parseDateKeyAsLocalDate(latestDate);

  while (distinctDateKeys.includes(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addLocalDays(cursor, -1);
  }

  return streak;
}

function mapDateStringToIso(date: string) {
  return parseDateKeyAsLocalDate(date).toISOString();
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
    guidedContext: row.guided_context ?? null,
    attachedPhotos: photoRefs.map((photoRef) => ({
      photoId: photoRef.photo_id,
      source: photoRef.source,
      path: photoRef.path,
      attachedAt: photoRef.attached_at,
      contentHash: photoRef.content_hash ?? undefined,
      filename: photoRef.filename ?? undefined,
      takenAt: photoRef.taken_at ?? undefined,
      fileSize: photoRef.file_size ?? undefined,
      width: photoRef.width ?? undefined,
      height: photoRef.height ?? undefined,
      localUri: photoRef.local_uri ?? undefined,
      syncStatus: normalizeAttachedPhotoSyncStatus(
        photoRef.sync_status,
        photoRef.source === "local" ? "pending_nas_match" : "linked_to_nas"
      ),
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
    .select(
      "id, memory_id, user_id, photo_id, source, path, content_hash, attached_at, filename, taken_at, file_size, width, height, local_uri, sync_status"
    )
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

async function insertPhotoRefs(
  memoryId: string,
  userId: string,
  attachedPhotos: Memory["attachedPhotos"]
) {
  if (!attachedPhotos.length) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("memory_photo_refs").insert(
    attachedPhotos.map((photo) => ({
      memory_id: memoryId,
      user_id: userId,
      photo_id: photo.photoId,
      source: photo.source,
      path: photo.path,
      content_hash: photo.contentHash ?? null,
      filename: photo.filename ?? null,
      taken_at: photo.takenAt ?? null,
      file_size: photo.fileSize ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      local_uri: photo.localUri ?? null,
      sync_status: photo.syncStatus,
      attached_at: photo.attachedAt,
    }))
  );

  if (error) {
    throw error;
  }
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const getMemories = async () => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memories")
      .select("id, user_id, date, prompt, text, tags, guided_context, created_at, updated_at")
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
      .select("id, user_id, date, prompt, text, tags, guided_context, created_at, updated_at")
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

  const getOnThisDayMemories = async (
    date: Date,
    options?: { limit?: number }
  ) => {
    const allMemories = await getMemories();
    const targetMonthDay = toMonthDayKey(date.toISOString());
    const targetYear = date.getUTCFullYear();
    const matchingMemories = allMemories.filter((memory) => {
      const memoryDate = new Date(memory.date);
      return (
        toMonthDayKey(memory.date) === targetMonthDay &&
        memoryDate.getUTCFullYear() < targetYear
      );
    });

    const limit = options?.limit;

    return typeof limit === "number"
      ? matchingMemories.slice(0, Math.max(limit, 0))
      : matchingMemories;
  };

  const getMemoryStats = async (date = new Date()) => {
    const allMemories = await getMemories();
    const currentMonth = date.getUTCMonth();
    const currentYear = date.getUTCFullYear();

    return {
      totalMemories: allMemories.length,
      totalPhotoRefs: allMemories.reduce(
        (total, memory) => total + memory.attachedPhotos.length,
        0
      ),
      thisMonthMemories: allMemories.filter((memory) => {
        const memoryDate = new Date(memory.date);

        return (
          memoryDate.getUTCMonth() === currentMonth &&
          memoryDate.getUTCFullYear() === currentYear
        );
      }).length,
      currentStreak: getCurrentStreak(allMemories, date),
    };
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
        guided_context: input.guidedContext ?? null,
      })
      .select("id, user_id, date, prompt, text, tags, guided_context, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    await insertPhotoRefs(data.id, userId, input.attachedPhotos);

    const memory = await getMemoryById(data.id);
    if (!memory) {
      throw new Error("Memory was created but could not be reloaded.");
    }

    return memory;
  };

  const updateMemory = async (
    id: string,
    input: Omit<CreateMemoryInput, "attachedPhotos">
  ) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from("memories")
      .update({
        date: input.date.slice(0, 10),
        prompt: input.prompt,
        text: input.text,
        tags: input.tags,
        guided_context: input.guidedContext ?? null,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    const memory = await getMemoryById(id);
    if (!memory) {
      throw new Error("Memory was updated but could not be reloaded.");
    }

    return memory;
  };

  const updateMemoryPhotoRefs = async (
    memoryId: string,
    attachedPhotos: Memory["attachedPhotos"]
  ) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();

    const { error: deleteError } = await supabase
      .from("memory_photo_refs")
      .delete()
      .eq("user_id", userId)
      .eq("memory_id", memoryId);

    if (deleteError) {
      throw deleteError;
    }

    if (!attachedPhotos.length) {
      return;
    }

    await insertPhotoRefs(memoryId, userId, attachedPhotos);
  };

  const deleteMemory = async (id: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
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
        memory.attachedPhotos
          .map(
            (photo) =>
              `${photo.photoId} ${photo.path} ${photo.filename ?? ""} ${photo.syncStatus}`
          )
          .join(" "),
      ];

      return searchableParts.some((part) =>
        normalizeSearchValue(part).includes(normalizedQuery)
      );
    });
  };

  const getDailyPrompt = (date = new Date()) => {
    const dayKey = toLocalDateKey(date).replaceAll("-", "");
    const promptIndex = Number(dayKey) % prompts.length;
    return prompts[promptIndex];
  };

  const value = useMemo<MemoryRepository>(
    () => ({
      getMemories,
      getOnThisDayMemories,
      getMemoryStats,
      getMemoryById,
      createMemory,
      updateMemory,
      deleteMemory,
      updateMemoryPhotoRefs,
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
