import { createContext, ReactNode, useContext, useMemo } from "react";

import { prompts } from "@/data/prompts";
import { addLocalDays, parseDateKeyAsLocalDate, toLocalDateKey } from "@/lib/dates";
import { createDefaultMemoryMetadata, normalizeMetadataList } from "@/lib/memoryMetadata";
import {
  getSupabaseClient,
  type SupabaseMemoryCollectionMembershipRow,
  type SupabaseMemoryCollectionRow,
  type SupabaseMemoryMetadataRow,
  type SupabaseMemoryMetadataSuggestionRow,
  type SupabaseMemoryPhotoRefRow,
  type SupabaseMemoryRow,
} from "@/lib/supabase";
import {
  generateDailyPromptWithAi,
  generateMetadataSuggestionsWithAi,
  isAiGatewayConfigured,
  type MetadataSuggestionVocabulary,
} from "@/services/ai/aiService";
import { getCurrentUser } from "@/services/auth/authService";
import { generateLocalDailyPrompt } from "@/services/dailyPromptGenerator";
import {
  clearCachedDailyPrompt,
  getCachedDailyPrompt,
  setCachedDailyPrompt,
} from "@/services/dailyPromptState";
import {
  normalizeAttachedMediaKind,
  normalizeAttachedPhotoSyncStatus,
} from "@/services/photo/photoDurability";
import type {
  AttachedPhotoSyncStatus,
  CreateMemoryCollectionInput,
  CreateMemoryInput,
  MemoryImportance,
  Memory,
  MemoryCollection,
  MemoryCollectionSummary,
  MemoryLifecycleStatus,
  MemoryMetadata,
  MemoryMetadataSuggestion,
  MemoryMetadataSuggestionField,
} from "@/types/memory";

type MemoryStats = {
  totalMemories: number;
  totalPhotoRefs: number;
  thisMonthMemories: number;
  currentStreak: number;
};

export type MemorySearchFilters = {
  query?: string;
  from?: string | null;
  to?: string | null;
  tags?: string[];
  collectionIds?: string[];
  hasPhotos?: boolean;
  hasGuidedContext?: boolean;
  isFavorite?: boolean;
  lifecycleStatuses?: MemoryLifecycleStatus[];
  importance?: MemoryImportance[];
  photoStatuses?: AttachedPhotoSyncStatus[];
};

type MemoryRepository = {
  getMemories: () => Promise<Memory[]>;
  getCollections: () => Promise<MemoryCollection[]>;
  getCollectionById: (id: string) => Promise<MemoryCollection | null>;
  getMemoriesForCollection: (collectionId: string) => Promise<Memory[]>;
  getOnThisDayMemories: (date: Date, options?: { limit?: number }) => Promise<Memory[]>;
  getMemoryCountForDate: (date: Date) => Promise<number>;
  getRandomResurfacedMemory: (
    date: Date,
    options?: {
      minAgeDays?: number;
      maxAgeDays?: number;
      excludeIds?: string[];
    }
  ) => Promise<Memory | null>;
  getMemoryStats: (date?: Date) => Promise<MemoryStats>;
  getMemoryById: (id: string) => Promise<Memory | null>;
  createCollection: (input: CreateMemoryCollectionInput) => Promise<MemoryCollection>;
  updateCollection: (
    id: string,
    input: CreateMemoryCollectionInput
  ) => Promise<MemoryCollection>;
  deleteCollection: (id: string) => Promise<void>;
  setMemoryCollectionMemberships: (memoryId: string, collectionIds: string[]) => Promise<void>;
  createMemory: (input: CreateMemoryInput) => Promise<Memory>;
  updateMemory: (id: string, input: Omit<CreateMemoryInput, "attachedPhotos">) => Promise<Memory>;
  deleteMemory: (id: string) => Promise<void>;
  updateMemoryPhotoRefs: (memoryId: string, attachedPhotos: Memory["attachedPhotos"]) => Promise<void>;
  getMemoryMetadataSuggestions: (memoryId: string) => Promise<MemoryMetadataSuggestion[]>;
  generateMemoryMetadataSuggestions: (memory: Memory) => Promise<MemoryMetadataSuggestion[]>;
  approveMemoryMetadataSuggestion: (suggestionId: string) => Promise<Memory>;
  rejectMemoryMetadataSuggestion: (suggestionId: string) => Promise<void>;
  searchMemories: (queryOrFilters: string | MemorySearchFilters) => Promise<Memory[]>;
  getDailyPrompt: (date?: Date) => Promise<string>;
};

const MemoryServiceContext = createContext<MemoryRepository | null>(null);

function sortMemories(memories: Memory[]) {
  return [...memories].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}

function sortCollections(collections: MemoryCollection[]) {
  return [...collections].sort((left, right) => {
    const startComparison =
      new Date(right.startDate ?? right.createdAt).getTime() -
      new Date(left.startDate ?? left.createdAt).getTime();

    if (startComparison !== 0) {
      return startComparison;
    }

    return left.title.localeCompare(right.title);
  });
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeSuggestionValue(value: string) {
  return normalizeSearchValue(value).replace(/\s+/g, " ");
}

function toSuggestionFieldMetadataKey(field: MemoryMetadataSuggestionField) {
  switch (field) {
    case "person":
      return "people";
    case "place":
      return "places";
    case "project":
      return "projects";
    case "topic":
      return "topics";
    case "tag":
      return null;
  }
}

function normalizeSearchTags(tags: string[] | undefined) {
  return [...new Set((tags ?? []).map((tag) => normalizeSearchValue(tag)).filter(Boolean))];
}

function normalizeSearchCollectionIds(collectionIds: string[] | undefined) {
  return [...new Set((collectionIds ?? []).map((id) => id.trim()).filter(Boolean))];
}

function normalizeSearchImportance(importance: MemoryImportance[] | undefined) {
  return [...new Set((importance ?? []).filter((value) => [1, 2, 3].includes(value)))];
}

function normalizeSearchLifecycleStatuses(
  lifecycleStatuses: MemoryLifecycleStatus[] | undefined
) {
  return [
    ...new Set(
      (lifecycleStatuses ?? []).filter(
        (status): status is MemoryLifecycleStatus => status === "draft" || status === "finalized"
      )
    ),
  ];
}

function normalizeSearchFilters(queryOrFilters: string | MemorySearchFilters): MemorySearchFilters {
  if (typeof queryOrFilters === "string") {
    return {
      query: queryOrFilters,
    };
  }

  return {
    query: queryOrFilters.query ?? "",
    from: queryOrFilters.from?.trim() ? queryOrFilters.from.slice(0, 10) : null,
    to: queryOrFilters.to?.trim() ? queryOrFilters.to.slice(0, 10) : null,
    tags: normalizeSearchTags(queryOrFilters.tags),
    collectionIds: normalizeSearchCollectionIds(queryOrFilters.collectionIds),
    hasPhotos: queryOrFilters.hasPhotos,
    hasGuidedContext: queryOrFilters.hasGuidedContext,
    isFavorite: queryOrFilters.isFavorite,
    lifecycleStatuses: normalizeSearchLifecycleStatuses(queryOrFilters.lifecycleStatuses),
    importance: normalizeSearchImportance(queryOrFilters.importance),
    photoStatuses: [...new Set(queryOrFilters.photoStatuses ?? [])],
  };
}

function matchesQuery(memory: Memory, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const searchableParts = [
    memory.date,
    memory.prompt,
    memory.text,
    memory.tags.join(" "),
    memory.collections.map((collection) => `${collection.title} ${collection.kind}`).join(" "),
    memory.guidedContext?.baseQuestion ?? "",
    memory.guidedContext?.originalAnswer ?? "",
    memory.guidedContext?.polishedSuggestion ?? "",
    memory.guidedContext?.followUps
      .map((followUp) => `${followUp.question} ${followUp.answer} ${followUp.status}`)
      .join(" ") ?? "",
    memory.metadata.lifecycleStatus,
    memory.metadata.isFavorite ? "favorite" : "",
    String(memory.metadata.importance ?? ""),
    memory.metadata.people.join(" "),
    memory.metadata.places.join(" "),
    memory.metadata.projects.join(" "),
    memory.metadata.topics.join(" "),
    memory.attachedPhotos
      .map(
        (photo) =>
          `${photo.photoId} ${photo.path} ${photo.filename ?? ""} ${photo.syncStatus} ${photo.source}`
      )
      .join(" "),
  ];

  return searchableParts.some((part) => normalizeSearchValue(part).includes(normalizedQuery));
}

function matchesStructuredFilters(memory: Memory, filters: MemorySearchFilters) {
  const memoryDate = memory.date.slice(0, 10);

  if (filters.from && memoryDate < filters.from) {
    return false;
  }

  if (filters.to && memoryDate > filters.to) {
    return false;
  }

  if (filters.tags?.length) {
    const memoryTags = new Set(memory.tags.map((tag) => normalizeSearchValue(tag)).filter(Boolean));
    const hasAllTags = filters.tags.every((tag) => memoryTags.has(tag));

    if (!hasAllTags) {
      return false;
    }
  }

  if (filters.collectionIds?.length) {
    const memoryCollectionIds = new Set(memory.collections.map((collection) => collection.id));
    const hasAnyCollection = filters.collectionIds.some((collectionId) =>
      memoryCollectionIds.has(collectionId)
    );

    if (!hasAnyCollection) {
      return false;
    }
  }

  if (filters.hasPhotos === true && !memory.attachedPhotos.length) {
    return false;
  }

  if (filters.hasGuidedContext === true && !memory.guidedContext) {
    return false;
  }

  if (filters.isFavorite === true && !memory.metadata.isFavorite) {
    return false;
  }

  if (filters.lifecycleStatuses?.length) {
    const hasLifecycle = filters.lifecycleStatuses.includes(memory.metadata.lifecycleStatus);
    if (!hasLifecycle) {
      return false;
    }
  }

  if (filters.importance?.length) {
    const hasImportance =
      memory.metadata.importance !== null && filters.importance.includes(memory.metadata.importance);

    if (!hasImportance) {
      return false;
    }
  }

  if (filters.photoStatuses?.length) {
    const memoryStatuses = new Set(memory.attachedPhotos.map((photo) => photo.syncStatus));
    const hasAnyStatus = filters.photoStatuses.some((status) => memoryStatuses.has(status));

    if (!hasAnyStatus) {
      return false;
    }
  }

  return true;
}

function toMonthDayKey(isoString: string) {
  return isoString.slice(5, 10);
}

function toDateKey(isoString: string) {
  return isoString.slice(0, 10);
}

function normalizeCollectionIds(collectionIds: string[] | undefined) {
  return [...new Set((collectionIds ?? []).map((id) => id.trim()).filter(Boolean))];
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

function mapCollectionDateStringToIso(date: string | null) {
  return date ? mapDateStringToIso(date) : null;
}

function mapCollectionRow(
  row: SupabaseMemoryCollectionRow,
  memoryCount = 0
): MemoryCollection {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    startDate: mapCollectionDateStringToIso(row.start_date),
    endDate: mapCollectionDateStringToIso(row.end_date),
    memoryCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCollectionToSummary(collection: MemoryCollection): MemoryCollectionSummary {
  return {
    id: collection.id,
    title: collection.title,
    kind: collection.kind,
  };
}

function mapMetadataRow(row: SupabaseMemoryMetadataRow | null | undefined): MemoryMetadata {
  return createDefaultMemoryMetadata({
    lifecycleStatus: row?.lifecycle_status,
    isFavorite: row?.is_favorite,
    importance: row?.importance ?? null,
    people: normalizeMetadataList(row?.people),
    places: normalizeMetadataList(row?.places),
    projects: normalizeMetadataList(row?.projects),
    topics: normalizeMetadataList(row?.topics),
  });
}

function mapMetadataSuggestionRow(
  row: SupabaseMemoryMetadataSuggestionRow
): MemoryMetadataSuggestion {
  return {
    id: row.id,
    memoryId: row.memory_id,
    field: row.field,
    value: row.value,
    matchedValue: row.matched_value,
    confidence: row.confidence,
    status: row.status,
    provider: row.provider,
    model: row.model,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function mapMemoryRow(
  row: SupabaseMemoryRow,
  metadataRow: SupabaseMemoryMetadataRow | null | undefined,
  photoRefs: SupabaseMemoryPhotoRefRow[],
  collections: MemoryCollectionSummary[]
): Memory {
  return {
    id: row.id,
    date: mapDateStringToIso(row.date),
    prompt: row.prompt,
    text: row.text,
    tags: row.tags ?? [],
    guidedContext: row.guided_context ?? null,
    metadata: mapMetadataRow(metadataRow),
    collections,
    attachedPhotos: photoRefs.map((photoRef) => ({
      photoId: photoRef.photo_id,
      mediaKind: normalizeAttachedMediaKind(photoRef.media_kind, "photo"),
      source: photoRef.source,
      path: photoRef.path,
      attachedAt: photoRef.attached_at,
      contentHash: photoRef.content_hash ?? undefined,
      filename: photoRef.filename ?? undefined,
      takenAt: photoRef.taken_at ?? undefined,
      fileSize: photoRef.file_size ?? undefined,
      width: photoRef.width ?? undefined,
      height: photoRef.height ?? undefined,
      durationMs: photoRef.duration_ms ?? undefined,
      mimeType: photoRef.mime_type ?? undefined,
      localUri: photoRef.local_uri ?? undefined,
      posterPath: photoRef.poster_path ?? undefined,
      posterLocalUri: photoRef.poster_local_uri ?? undefined,
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
      "id, memory_id, user_id, photo_id, media_kind, source, path, content_hash, attached_at, filename, taken_at, file_size, width, height, duration_ms, mime_type, local_uri, poster_path, poster_local_uri, sync_status"
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

async function fetchMetadataByMemoryIds(memoryIds: string[]) {
  if (!memoryIds.length) {
    return new Map<string, SupabaseMemoryMetadataRow>();
  }

  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_metadata")
    .select(
      "memory_id, user_id, lifecycle_status, is_favorite, importance, people, places, projects, topics, created_at, updated_at"
    )
    .eq("user_id", userId)
    .in("memory_id", memoryIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as SupabaseMemoryMetadataRow[]).map((row) => [row.memory_id, row] as const)
  );
}

async function fetchMetadataSuggestionsByMemoryId(memoryId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_metadata_suggestions")
    .select(
      "id, memory_id, user_id, field, value, matched_value, confidence, status, provider, model, created_at, reviewed_at"
    )
    .eq("user_id", userId)
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SupabaseMemoryMetadataSuggestionRow[]).map(mapMetadataSuggestionRow);
}

async function fetchCollectionRowsByUser(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("memory_collections")
    .select("id, user_id, title, kind, description, start_date, end_date, created_at, updated_at")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMemoryCollectionRow[];
}

async function fetchCollectionMembershipRowsByMemoryIds(memoryIds: string[]) {
  if (!memoryIds.length) {
    return [] as SupabaseMemoryCollectionMembershipRow[];
  }

  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_collection_memberships")
    .select("id, collection_id, memory_id, user_id, added_at")
    .eq("user_id", userId)
    .in("memory_id", memoryIds)
    .order("added_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMemoryCollectionMembershipRow[];
}

async function fetchCollectionMembershipRowsByCollectionId(collectionId: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_collection_memberships")
    .select("id, collection_id, memory_id, user_id, added_at")
    .eq("user_id", userId)
    .eq("collection_id", collectionId)
    .order("added_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMemoryCollectionMembershipRow[];
}

async function fetchCollectionMembershipCountsByCollectionIds(collectionIds: string[]) {
  if (!collectionIds.length) {
    return new Map<string, number>();
  }

  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memory_collection_memberships")
    .select("collection_id")
    .eq("user_id", userId)
    .in("collection_id", collectionIds);

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ collection_id: string }>) {
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }

  return counts;
}

async function fetchCollectionSummariesByMemoryIds(memoryIds: string[]) {
  if (!memoryIds.length) {
    return new Map<string, MemoryCollectionSummary[]>();
  }

  const userId = await getUserIdOrThrow();
  const [collectionRows, membershipRows] = await Promise.all([
    fetchCollectionRowsByUser(userId),
    fetchCollectionMembershipRowsByMemoryIds(memoryIds),
  ]);

  const summariesByCollectionId = new Map(
    collectionRows.map((row) => {
      const collection = mapCollectionRow(row);
      return [collection.id, mapCollectionToSummary(collection)] as const;
    })
  );

  const summariesByMemoryId = new Map<string, MemoryCollectionSummary[]>();
  for (const membership of membershipRows) {
    const summary = summariesByCollectionId.get(membership.collection_id);
    if (!summary) {
      continue;
    }

    const current = summariesByMemoryId.get(membership.memory_id) ?? [];
    current.push(summary);
    summariesByMemoryId.set(membership.memory_id, current);
  }

  return summariesByMemoryId;
}

async function fetchPromptsForDate(dateKey: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();
  const { data, error } = await supabase
    .from("memories")
    .select("prompt")
    .eq("user_id", userId)
    .eq("date", dateKey)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ prompt: string | null }>).map((row) => row.prompt?.trim() ?? "").filter(Boolean);
}

async function fetchMemoryRowsForUser(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("memories")
    .select("id, user_id, date, prompt, text, tags, guided_context, created_at, updated_at")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMemoryRow[];
}

async function fetchMemoryRowsByIds(userId: string, memoryIds: string[]) {
  if (!memoryIds.length) {
    return [] as SupabaseMemoryRow[];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("memories")
    .select("id, user_id, date, prompt, text, tags, guided_context, created_at, updated_at")
    .eq("user_id", userId)
    .in("id", memoryIds)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMemoryRow[];
}

async function loadMemoriesFromRows(rows: SupabaseMemoryRow[]) {
  const memoryIds = rows.map((row) => row.id);
  const [refsByMemoryId, collectionsByMemoryId, metadataByMemoryId] = await Promise.all([
    fetchPhotoRefsByMemoryIds(memoryIds),
    fetchCollectionSummariesByMemoryIds(memoryIds),
    fetchMetadataByMemoryIds(memoryIds),
  ]);
  return sortMemories(
    rows.map((row) =>
      mapMemoryRow(
        row,
        metadataByMemoryId.get(row.id),
        refsByMemoryId.get(row.id) ?? [],
        collectionsByMemoryId.get(row.id) ?? []
      )
    )
  );
}

async function upsertMemoryMetadata(
  memoryId: string,
  userId: string,
  metadata: MemoryMetadata | undefined
) {
  const supabase = getSupabaseClient();
  const normalized = createDefaultMemoryMetadata(metadata);
  const { error } = await supabase.from("memory_metadata").upsert(
    {
      memory_id: memoryId,
      user_id: userId,
      lifecycle_status: normalized.lifecycleStatus,
      is_favorite: normalized.isFavorite,
      importance: normalized.importance,
      people: normalized.people,
      places: normalized.places,
      projects: normalized.projects,
      topics: normalized.topics,
    },
    {
      onConflict: "memory_id",
    }
  );

  if (error) {
    throw error;
  }
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
      media_kind: photo.mediaKind ?? "photo",
      source: photo.source,
      path: photo.path,
      content_hash: photo.contentHash ?? null,
      filename: photo.filename ?? null,
      taken_at: photo.takenAt ?? null,
      file_size: photo.fileSize ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      duration_ms: photo.durationMs ?? null,
      mime_type: photo.mimeType ?? null,
      local_uri: photo.localUri ?? null,
      poster_path: photo.posterPath ?? null,
      poster_local_uri: photo.posterLocalUri ?? null,
      sync_status: photo.syncStatus,
      attached_at: photo.attachedAt,
    }))
  );

  if (error) {
    throw error;
  }
}

async function insertCollectionMemberships(
  memoryId: string,
  userId: string,
  collectionIds: string[]
) {
  const normalizedCollectionIds = normalizeCollectionIds(collectionIds);

  if (!normalizedCollectionIds.length) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("memory_collection_memberships").insert(
    normalizedCollectionIds.map((collectionId) => ({
      collection_id: collectionId,
      memory_id: memoryId,
      user_id: userId,
    }))
  );

  if (error) {
    throw error;
  }
}

export function MemoryProvider({ children }: { children: ReactNode }) {
  const getMemories = async () => {
    const userId = await getUserIdOrThrow();
    return loadMemoriesFromRows(await fetchMemoryRowsForUser(userId));
  };

  const getCollections = async () => {
    const userId = await getUserIdOrThrow();
    const collectionRows = await fetchCollectionRowsByUser(userId);
    const collectionIds = collectionRows.map((row) => row.id);
    const countsByCollectionId = await fetchCollectionMembershipCountsByCollectionIds(collectionIds);

    return sortCollections(
      collectionRows.map((row) => mapCollectionRow(row, countsByCollectionId.get(row.id) ?? 0))
    );
  };

  const getCollectionById = async (id: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memory_collections")
      .select("id, user_id, title, kind, description, start_date, end_date, created_at, updated_at")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const countsByCollectionId = await fetchCollectionMembershipCountsByCollectionIds([id]);
    return mapCollectionRow(
      data as SupabaseMemoryCollectionRow,
      countsByCollectionId.get(id) ?? 0
    );
  };

  const getMemoriesForCollection = async (collectionId: string) => {
    const userId = await getUserIdOrThrow();
    const membershipRows = await fetchCollectionMembershipRowsByCollectionId(collectionId);
    const memoryIds = membershipRows.map((row) => row.memory_id);

    if (!memoryIds.length) {
      return [];
    }

    return loadMemoriesFromRows(await fetchMemoryRowsByIds(userId, memoryIds));
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

    const [refsByMemoryId, collectionsByMemoryId] = await Promise.all([
      fetchPhotoRefsByMemoryIds([data.id]),
      fetchCollectionSummariesByMemoryIds([data.id]),
    ]);
    const metadataByMemoryId = await fetchMetadataByMemoryIds([data.id]);
    return mapMemoryRow(
      data as SupabaseMemoryRow,
      metadataByMemoryId.get(data.id),
      refsByMemoryId.get(data.id) ?? [],
      collectionsByMemoryId.get(data.id) ?? []
    );
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

  const getMemoryCountForDate = async (date: Date) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const dateKey = toLocalDateKey(date);
    const { count, error } = await supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", dateKey);

    if (error) {
      throw error;
    }

    return count ?? 0;
  };

  const getRandomResurfacedMemory = async (
    date: Date,
    options?: {
      minAgeDays?: number;
      maxAgeDays?: number;
      excludeIds?: string[];
    }
  ) => {
    const userId = await getUserIdOrThrow();
    const allMemoryRows = await fetchMemoryRowsForUser(userId);
    const todayKey = toLocalDateKey(date);
    const minAgeDays = Math.max(options?.minAgeDays ?? 30, 0);
    const maxAgeDays = Math.max(options?.maxAgeDays ?? 3650, minAgeDays);
    const excludeIds = new Set(options?.excludeIds ?? []);
    const todayTimestamp = parseDateKeyAsLocalDate(todayKey).getTime();

    const allCandidates = allMemoryRows.filter((memory) => {
      if (excludeIds.has(memory.id)) {
        return false;
      }

      const memoryKey = memory.date.slice(0, 10);
      if (memoryKey === todayKey) {
        return false;
      }

      const ageMs = todayTimestamp - parseDateKeyAsLocalDate(memoryKey).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      return ageDays >= 1 && ageDays <= maxAgeDays;
    });

    const candidates = allCandidates.filter((memory) => {
      const memoryKey = memory.date.slice(0, 10);
      const ageMs = todayTimestamp - parseDateKeyAsLocalDate(memoryKey).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      return ageDays >= minAgeDays && ageDays <= maxAgeDays;
    });

    const pool = candidates.length ? candidates : allCandidates;

    if (!pool.length) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const selected = pool[randomIndex];

    return selected ? getMemoryById(selected.id) : null;
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

  const createCollection = async (input: CreateMemoryCollectionInput) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memory_collections")
      .insert({
        user_id: userId,
        title: input.title.trim(),
        kind: input.kind,
        description: input.description?.trim() || null,
        start_date: input.startDate?.slice(0, 10) ?? null,
        end_date: input.endDate?.slice(0, 10) ?? null,
      })
      .select("id, user_id, title, kind, description, start_date, end_date, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return mapCollectionRow(data as SupabaseMemoryCollectionRow, 0);
  };

  const updateCollection = async (id: string, input: CreateMemoryCollectionInput) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from("memory_collections")
      .update({
        title: input.title.trim(),
        kind: input.kind,
        description: input.description?.trim() || null,
        start_date: input.startDate?.slice(0, 10) ?? null,
        end_date: input.endDate?.slice(0, 10) ?? null,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    const collection = await getCollectionById(id);
    if (!collection) {
      throw new Error("Collection was updated but could not be reloaded.");
    }

    return collection;
  };

  const deleteCollection = async (id: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from("memory_collections")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  };

  const setMemoryCollectionMemberships = async (memoryId: string, collectionIds: string[]) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();

    const { error: deleteError } = await supabase
      .from("memory_collection_memberships")
      .delete()
      .eq("user_id", userId)
      .eq("memory_id", memoryId);

    if (deleteError) {
      throw deleteError;
    }

    await insertCollectionMemberships(memoryId, userId, collectionIds);
  };

  const createMemory = async (input: CreateMemoryInput) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const dateKey = input.date.slice(0, 10);
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: userId,
        date: dateKey,
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

    await upsertMemoryMetadata(data.id, userId, input.metadata);
    await insertPhotoRefs(data.id, userId, input.attachedPhotos);
    await insertCollectionMemberships(data.id, userId, input.collectionIds ?? []);

    const memory = await getMemoryById(data.id);
    if (!memory) {
      throw new Error("Memory was created but could not be reloaded.");
    }

    await clearCachedDailyPrompt(userId, dateKey);

    return memory;
  };

  const updateMemory = async (
    id: string,
    input: Omit<CreateMemoryInput, "attachedPhotos">
    ) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const existingMemory = await getMemoryById(id);
    const nextDateKey = input.date.slice(0, 10);
    const { error } = await supabase
      .from("memories")
      .update({
        date: nextDateKey,
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

    await upsertMemoryMetadata(id, userId, input.metadata);
    if (Array.isArray(input.collectionIds)) {
      await setMemoryCollectionMemberships(id, input.collectionIds);
    }

    const memory = await getMemoryById(id);
    if (!memory) {
      throw new Error("Memory was updated but could not be reloaded.");
    }

    const dateKeysToClear = new Set<string>([nextDateKey]);
    if (existingMemory) {
      dateKeysToClear.add(existingMemory.date.slice(0, 10));
    }

    await Promise.all(
      [...dateKeysToClear].map((dateKey) => clearCachedDailyPrompt(userId, dateKey))
    );

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

  const getMemoryMetadataSuggestions = async (memoryId: string) =>
    fetchMetadataSuggestionsByMemoryId(memoryId);

  const generateMemoryMetadataSuggestions = async (memory: Memory) => {
    if (!isAiGatewayConfigured()) {
      throw new Error("AI suggestions need the local AI gateway to be configured.");
    }

    const allMemories = await getMemories();
    const fieldValues: MetadataSuggestionVocabulary = {
      tag: [],
      person: [],
      place: [],
      project: [],
      topic: [],
    };

    for (const candidate of allMemories) {
      fieldValues.tag.push(...candidate.tags);
      fieldValues.person.push(...candidate.metadata.people);
      fieldValues.place.push(...candidate.metadata.places);
      fieldValues.project.push(...candidate.metadata.projects);
      fieldValues.topic.push(...candidate.metadata.topics);
    }

    const vocabulary = Object.fromEntries(
      (Object.keys(fieldValues) as MemoryMetadataSuggestionField[]).map((field) => [
        field,
        [...new Map(fieldValues[field].map((value) => [normalizeSuggestionValue(value), value])).values()]
          .filter(Boolean)
          .slice(0, 80),
      ])
    ) as MetadataSuggestionVocabulary;
    const result = await generateMetadataSuggestionsWithAi({
      prompt: memory.prompt,
      text: memory.text,
      vocabulary,
    });
    const userId = await getUserIdOrThrow();
    const supabase = getSupabaseClient();

    const { error: clearError } = await supabase
      .from("memory_metadata_suggestions")
      .delete()
      .eq("user_id", userId)
      .eq("memory_id", memory.id)
      .eq("status", "pending");

    if (clearError) {
      throw clearError;
    }

    const rows: Array<{
      memory_id: string;
      user_id: string;
      field: MemoryMetadataSuggestionField;
      value: string;
      matched_value: string | null;
      confidence: number;
      provider: string;
      model: string;
    }> = [];

    for (const suggestion of result.suggestions) {
      const value = suggestion.value.trim();
      if (!value) {
        continue;
      }

      const canonicalMatch = vocabulary[suggestion.field].find(
        (candidate) =>
          normalizeSuggestionValue(candidate) ===
          normalizeSuggestionValue(suggestion.matchedValue ?? value)
      );
      rows.push({
        memory_id: memory.id,
        user_id: userId,
        field: suggestion.field,
        value: canonicalMatch ?? value,
        matched_value: canonicalMatch ?? null,
        confidence: Math.max(0, Math.min(100, Math.round(suggestion.confidence))),
        provider: result.provider,
        model: result.model,
      });
    }

    if (!rows.length) {
      return [];
    }

    const { error: insertError } = await supabase.from("memory_metadata_suggestions").insert(rows);
    if (insertError) {
      throw insertError;
    }

    return fetchMetadataSuggestionsByMemoryId(memory.id);
  };

  const approveMemoryMetadataSuggestion = async (suggestionId: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { data, error } = await supabase
      .from("memory_metadata_suggestions")
      .select(
        "id, memory_id, user_id, field, value, matched_value, confidence, status, provider, model, created_at, reviewed_at"
      )
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("That suggestion is no longer available for approval.");
    }

    const suggestion = mapMetadataSuggestionRow(data as SupabaseMemoryMetadataSuggestionRow);
    const memory = await getMemoryById(suggestion.memoryId);
    if (!memory) {
      throw new Error("The chapter for this suggestion could not be found.");
    }

    const approvedValue = suggestion.matchedValue ?? suggestion.value;
    if (suggestion.field === "tag") {
      const { error: tagError } = await supabase
        .from("memories")
        .update({ tags: normalizeMetadataList([...memory.tags, approvedValue]) })
        .eq("id", memory.id)
        .eq("user_id", userId);
      if (tagError) {
        throw tagError;
      }
    } else {
      const metadataField = toSuggestionFieldMetadataKey(suggestion.field);
      if (metadataField) {
        await upsertMemoryMetadata(memory.id, userId, {
          ...memory.metadata,
          [metadataField]: normalizeMetadataList([...memory.metadata[metadataField], approvedValue]),
        });
      }
    }

    const { error: approveError } = await supabase
      .from("memory_metadata_suggestions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", suggestion.id)
      .eq("user_id", userId);
    if (approveError) {
      throw approveError;
    }

    const updatedMemory = await getMemoryById(memory.id);
    if (!updatedMemory) {
      throw new Error("Suggestion was approved but the chapter could not be reloaded.");
    }

    return updatedMemory;
  };

  const rejectMemoryMetadataSuggestion = async (suggestionId: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const { error } = await supabase
      .from("memory_metadata_suggestions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", suggestionId)
      .eq("user_id", userId)
      .eq("status", "pending");

    if (error) {
      throw error;
    }
  };

  const deleteMemory = async (id: string) => {
    const supabase = getSupabaseClient();
    const userId = await getUserIdOrThrow();
    const existingMemory = await getMemoryById(id);
    const { error } = await supabase
      .from("memories")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    if (existingMemory) {
      await clearCachedDailyPrompt(userId, existingMemory.date.slice(0, 10));
    }
  };

  const searchMemories = async (queryOrFilters: string | MemorySearchFilters) => {
    const allMemories = await getMemories();
    const filters = normalizeSearchFilters(queryOrFilters);
    const normalizedQuery = normalizeSearchValue(filters.query ?? "");

    return allMemories.filter(
      (memory) => matchesQuery(memory, normalizedQuery) && matchesStructuredFilters(memory, filters)
    );
  };

  const getDailyPrompt = async (date = new Date()) => {
    const userId = await getUserIdOrThrow();
    const dateKey = toLocalDateKey(date);
    const cachedPrompt = await getCachedDailyPrompt(userId, dateKey);

    if (cachedPrompt) {
      return cachedPrompt;
    }

    const priorPrompts = await fetchPromptsForDate(dateKey);

    if (isAiGatewayConfigured()) {
      try {
        const result = await generateDailyPromptWithAi(
          date.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          priorPrompts.length,
          priorPrompts
        );
        await setCachedDailyPrompt(userId, dateKey, result.prompt);
        return result.prompt;
      } catch {
        const fallbackPrompt = generateLocalDailyPrompt(date, priorPrompts);
        await setCachedDailyPrompt(userId, dateKey, fallbackPrompt);
        return fallbackPrompt;
      }
    }

    if (!priorPrompts.length) {
      const dayKey = dateKey.replaceAll("-", "");
      const promptIndex = Number(dayKey) % prompts.length;
      const prompt = prompts[promptIndex];
      await setCachedDailyPrompt(userId, dateKey, prompt);
      return prompt;
    }

    const prompt = generateLocalDailyPrompt(date, priorPrompts);
    await setCachedDailyPrompt(userId, dateKey, prompt);
    return prompt;
  };

  const value = useMemo<MemoryRepository>(
    () => ({
      getMemories,
      getCollections,
      getCollectionById,
      getMemoriesForCollection,
      getOnThisDayMemories,
      getMemoryCountForDate,
      getRandomResurfacedMemory,
      getMemoryStats,
      getMemoryById,
      createCollection,
      updateCollection,
      deleteCollection,
      setMemoryCollectionMemberships,
      createMemory,
      updateMemory,
      deleteMemory,
      updateMemoryPhotoRefs,
      getMemoryMetadataSuggestions,
      generateMemoryMetadataSuggestions,
      approveMemoryMetadataSuggestion,
      rejectMemoryMetadataSuggestion,
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
