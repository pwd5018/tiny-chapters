import {
  getAttachedPhotoSourceLabel,
  getAttachedPhotoStatusNote,
  getAttachedPhotoSyncStatusLabel,
} from "@/services/photo/photoDurability";
import type { Memory } from "@/types/memory";
import type {
  MemoryArchiveExport,
  MemoryExportEntry,
  MemoryExportFilters,
  MemoryExportFilterSummary,
  MemoryExportSummary,
} from "@/types/export";

const EXPORT_SCHEMA_VERSION = "2026-07-phase13-v1" as const;

function normalizeDateBoundary(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function normalizeTagFilters(tags: string[] | null | undefined) {
  const uniqueTags = new Set<string>();

  for (const tag of tags ?? []) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) {
      uniqueTags.add(normalized);
    }
  }

  return [...uniqueTags];
}

function toFilterSummary(filters?: MemoryExportFilters): MemoryExportFilterSummary {
  return {
    from: normalizeDateBoundary(filters?.from),
    to: normalizeDateBoundary(filters?.to),
    tags: normalizeTagFilters(filters?.tags),
  };
}

function isMemoryIncluded(memory: Memory, filterSummary: MemoryExportFilterSummary) {
  const memoryDate = memory.date.slice(0, 10);

  if (filterSummary.from && memoryDate < filterSummary.from) {
    return false;
  }

  if (filterSummary.to && memoryDate > filterSummary.to) {
    return false;
  }

  if (!filterSummary.tags.length) {
    return true;
  }

  const memoryTags = new Set(memory.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return filterSummary.tags.every((tag) => memoryTags.has(tag));
}

function mapMemoryToExportEntry(memory: Memory): MemoryExportEntry {
  return {
    id: memory.id,
    date: memory.date,
    prompt: memory.prompt,
    text: memory.text,
    tags: memory.tags,
    guidedContext: memory.guidedContext,
    attachedPhotoCount: memory.attachedPhotos.length,
    photoManifest: memory.attachedPhotos.map((photo) => ({
      photoId: photo.photoId,
      source: photo.source,
      path: photo.path,
      filename: photo.filename ?? null,
      contentHash: photo.contentHash ?? null,
      takenAt: photo.takenAt ?? null,
      attachedAt: photo.attachedAt,
      fileSize: photo.fileSize ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      syncStatus: photo.syncStatus,
      syncStatusLabel: getAttachedPhotoSyncStatusLabel(photo.syncStatus),
      sourceLabel: getAttachedPhotoSourceLabel(photo),
      statusNote: getAttachedPhotoStatusNote(photo),
      localUriIncluded: Boolean(photo.localUri),
    })),
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function buildExportSummary(memories: MemoryExportEntry[]): MemoryExportSummary {
  const summary: MemoryExportSummary = {
    memoryCount: memories.length,
    taggedMemoryCount: 0,
    memoryWithPhotosCount: 0,
    totalPhotoReferences: 0,
    linkedNasPhotoCount: 0,
    pendingNasMatchCount: 0,
    localOnlyPhotoCount: 0,
    missingPhotoCount: 0,
    preservedCopyPhotoCount: 0,
  };

  for (const memory of memories) {
    if (memory.tags.length) {
      summary.taggedMemoryCount += 1;
    }

    if (memory.photoManifest.length) {
      summary.memoryWithPhotosCount += 1;
    }

    summary.totalPhotoReferences += memory.photoManifest.length;

    for (const photo of memory.photoManifest) {
      switch (photo.syncStatus) {
        case "linked_to_nas":
          summary.linkedNasPhotoCount += 1;
          break;
        case "pending_nas_match":
          summary.pendingNasMatchCount += 1;
          break;
        case "local_only":
          summary.localOnlyPhotoCount += 1;
          break;
        case "missing":
          summary.missingPhotoCount += 1;
          break;
        case "preserved_copy":
          summary.preservedCopyPhotoCount += 1;
          break;
      }
    }
  }

  return summary;
}

export function filterMemoriesForExport(memories: Memory[], filters?: MemoryExportFilters) {
  const filterSummary = toFilterSummary(filters);
  return memories.filter((memory) => isMemoryIncluded(memory, filterSummary));
}

export function buildMemoryArchiveExport(
  memories: Memory[],
  options?: {
    exportedAt?: string;
    filters?: MemoryExportFilters;
  }
): MemoryArchiveExport {
  const filterSummary = toFilterSummary(options?.filters);
  const filteredMemories = memories.filter((memory) => isMemoryIncluded(memory, filterSummary));
  const exportEntries = filteredMemories.map(mapMemoryToExportEntry);

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportType: "tiny-chapters-archive",
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
    filters: filterSummary,
    summary: buildExportSummary(exportEntries),
    memories: exportEntries,
  };
}
