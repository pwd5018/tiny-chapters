import { getSupabaseClient, type SupabaseMemoryPhotoRefRow } from "@/lib/supabase";
import { getCurrentUser } from "@/services/auth/authService";
import {
  normalizeAttachedMediaKind,
  normalizeAttachedPhotoSyncStatus,
} from "@/services/photo/photoDurability";
import {
  inspectPhotoMatchCandidate,
  isNasPhotoMatchingAvailable,
  matchPhotoCandidate,
} from "@/services/photo/photoService";
import type { AttachedPhotoRef } from "@/types/memory";
import type { PhotoMatchCandidate, PhotoMatchDiagnosticResult } from "@/types/photo";

type PendingRefRow = SupabaseMemoryPhotoRefRow & {
  memory_id: string;
};

export type NasRelinkSummary = {
  checked: number;
  matched: number;
  stillPending: number;
  errors: number;
};

export type MemoryRelinkResult = NasRelinkSummary & {
  changed: boolean;
};

export type PhotoDurabilitySummary = {
  pendingNasMatches: number;
  linkedNasPhotos: number;
  missingPhotos: number;
};

export type PendingNasMatchDiagnostic = {
  memoryId: string;
  ref: AttachedPhotoRef;
  candidate: PhotoMatchCandidate;
  matchResult: PhotoMatchDiagnosticResult;
};

function mapPhotoRefRow(row: SupabaseMemoryPhotoRefRow): AttachedPhotoRef {
  return {
    photoId: row.photo_id,
    mediaKind: normalizeAttachedMediaKind(row.media_kind, "photo"),
    source: row.source,
    path: row.path,
    attachedAt: row.attached_at,
    contentHash: row.content_hash ?? undefined,
    filename: row.filename ?? undefined,
    takenAt: row.taken_at ?? undefined,
    fileSize: row.file_size ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    mimeType: row.mime_type ?? undefined,
    localUri: row.local_uri ?? undefined,
    posterPath: row.poster_path ?? undefined,
    posterLocalUri: row.poster_local_uri ?? undefined,
    syncStatus: normalizeAttachedPhotoSyncStatus(
      row.sync_status,
      row.source === "local" ? "pending_nas_match" : "linked_to_nas"
    ),
  };
}

function areRefsEqual(left: AttachedPhotoRef, right: AttachedPhotoRef) {
  return (
    left.photoId === right.photoId &&
    left.source === right.source &&
    left.path === right.path &&
    left.attachedAt === right.attachedAt &&
    left.contentHash === right.contentHash &&
    left.filename === right.filename &&
    left.takenAt === right.takenAt &&
    left.fileSize === right.fileSize &&
    left.width === right.width &&
    left.height === right.height &&
    left.durationMs === right.durationMs &&
    left.mimeType === right.mimeType &&
    left.localUri === right.localUri &&
    left.posterPath === right.posterPath &&
    left.posterLocalUri === right.posterLocalUri &&
    left.syncStatus === right.syncStatus
  );
}

function isPendingNasMatchRef(ref: AttachedPhotoRef) {
  return ref.source === "local" && ref.syncStatus === "pending_nas_match";
}

function buildMatchCandidate(ref: AttachedPhotoRef): PhotoMatchCandidate {
  return {
    filename: ref.filename,
    takenAt: ref.takenAt,
    fileSize: ref.fileSize,
    width: ref.width,
    height: ref.height,
  };
}

async function getUserIdOrThrow() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to access photo relink status.");
  }

  return user.id;
}

async function fetchPhotoRefRows(memoryId?: string) {
  const supabase = getSupabaseClient();
  const userId = await getUserIdOrThrow();

  let query = supabase
    .from("memory_photo_refs")
    .select(
      "id, memory_id, user_id, photo_id, media_kind, source, path, content_hash, attached_at, filename, taken_at, file_size, width, height, duration_ms, mime_type, local_uri, poster_path, poster_local_uri, sync_status"
    )
    .eq("user_id", userId)
    .order("attached_at", { ascending: true });

  if (memoryId) {
    query = query.eq("memory_id", memoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as PendingRefRow[];
}

async function savePhotoRefsForMemory(memoryId: string, refs: AttachedPhotoRef[]) {
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

  if (!refs.length) {
    return;
  }

  const { error: insertError } = await supabase.from("memory_photo_refs").insert(
    refs.map((photo) => ({
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

  if (insertError) {
    throw insertError;
  }
}

export async function getPendingNasMatchRefs(memoryId?: string): Promise<AttachedPhotoRef[]> {
  const rows = await fetchPhotoRefRows(memoryId);

  return rows.map(mapPhotoRefRow).filter(isPendingNasMatchRef);
}

export async function getPhotoDurabilitySummary(): Promise<PhotoDurabilitySummary> {
  const rows = await fetchPhotoRefRows();

  return rows.reduce<PhotoDurabilitySummary>(
    (summary, row) => {
      const ref = mapPhotoRefRow(row);

      switch (ref.syncStatus) {
        case "pending_nas_match":
          summary.pendingNasMatches += 1;
          break;
        case "linked_to_nas":
          summary.linkedNasPhotos += 1;
          break;
        case "missing":
          summary.missingPhotos += 1;
          break;
      }

      return summary;
    },
    {
      pendingNasMatches: 0,
      linkedNasPhotos: 0,
      missingPhotos: 0,
    }
  );
}

export async function attemptNasRelinkForRef(ref: AttachedPhotoRef): Promise<AttachedPhotoRef> {
  if (!isPendingNasMatchRef(ref) || !isNasPhotoMatchingAvailable()) {
    return ref;
  }

  if ((ref.mediaKind ?? "photo") !== "photo") {
    return ref;
  }

  try {
    const matchedPhoto = await matchPhotoCandidate(buildMatchCandidate(ref));

    if (!matchedPhoto) {
      return ref;
    }

    return {
      photoId: matchedPhoto.id,
      mediaKind: "photo",
      source: "nas",
      path: matchedPhoto.path,
      attachedAt: ref.attachedAt,
      contentHash: matchedPhoto.contentHash,
      filename: matchedPhoto.filename,
      takenAt: matchedPhoto.takenAt,
      fileSize: matchedPhoto.fileSize,
      width: matchedPhoto.width,
      height: matchedPhoto.height,
      localUri: undefined,
      syncStatus: "linked_to_nas",
    };
  } catch {
    return ref;
  }
}

export async function attemptNasRelinkForMemory(
  memoryId: string
): Promise<MemoryRelinkResult> {
  const rows = await fetchPhotoRefRows(memoryId);
  const currentRefs = rows.map(mapPhotoRefRow);
  const pendingRefs = currentRefs.filter(isPendingNasMatchRef);

  if (!pendingRefs.length) {
    return {
      checked: 0,
      matched: 0,
      stillPending: 0,
      errors: 0,
      changed: false,
    };
  }

  let checked = 0;
  let matched = 0;
  let stillPending = 0;

  const nextRefs = await Promise.all(
    currentRefs.map(async (ref) => {
      if (!isPendingNasMatchRef(ref)) {
        return ref;
      }

      checked += 1;
      const nextRef = await attemptNasRelinkForRef(ref);

      if (nextRef.source === "nas" && nextRef.syncStatus === "linked_to_nas") {
        matched += 1;
      } else {
        stillPending += 1;
      }

      return nextRef;
    })
  );

  const changed = nextRefs.some((ref, index) => !areRefsEqual(ref, currentRefs[index]));

  if (changed) {
    await savePhotoRefsForMemory(memoryId, nextRefs);
  }

  return {
    checked,
    matched,
    stillPending,
    errors: 0,
    changed,
  };
}

export async function attemptNasRelinkForAllMemories(): Promise<NasRelinkSummary> {
  const rows = await fetchPhotoRefRows();
  const pendingMemoryIds = Array.from(
    new Set(
      rows
        .filter((row) => isPendingNasMatchRef(mapPhotoRefRow(row)))
        .map((row) => row.memory_id)
    )
  );

  let summary: NasRelinkSummary = {
    checked: 0,
    matched: 0,
    stillPending: 0,
    errors: 0,
  };

  for (const memoryId of pendingMemoryIds) {
    try {
      const result = await attemptNasRelinkForMemory(memoryId);
      summary = {
        checked: summary.checked + result.checked,
        matched: summary.matched + result.matched,
        stillPending: summary.stillPending + result.stillPending,
        errors: summary.errors + result.errors,
      };
    } catch {
      const pendingForMemory = rows
        .filter((row) => row.memory_id === memoryId)
        .map(mapPhotoRefRow)
        .filter(isPendingNasMatchRef).length;

      summary = {
        ...summary,
        checked: summary.checked + pendingForMemory,
        stillPending: summary.stillPending + pendingForMemory,
        errors: summary.errors + pendingForMemory,
      };
    }
  }

  return summary;
}

export async function retryPendingNasMatches() {
  return attemptNasRelinkForAllMemories();
}

export async function inspectPendingNasMatchRefs(
  options?: { limit?: number }
): Promise<PendingNasMatchDiagnostic[]> {
  const rows = await fetchPhotoRefRows();
  const limit = Math.max(1, options?.limit ?? 5);
  const pendingRows = rows
    .filter((row) => isPendingNasMatchRef(mapPhotoRefRow(row)))
    .slice(0, limit);

  return Promise.all(
    pendingRows.map(async (row) => {
      const ref = mapPhotoRefRow(row);
      const candidate = buildMatchCandidate(ref);
      const matchResult = await inspectPhotoMatchCandidate(candidate);

      return {
        memoryId: row.memory_id,
        ref,
        candidate,
        matchResult,
      };
    })
  );
}
