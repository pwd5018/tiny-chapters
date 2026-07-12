import {
  getAttachedPhotoSourceLabel,
  getAttachedPhotoStatusNote,
  getAttachedPhotoSyncStatusLabel,
} from "@/services/photo/photoDurability";
import type { Memory } from "@/types/memory";
import type {
  MemoryArchiveExport,
  MemoryExportCollectionSummary,
  MemoryExportDateRangeSummary,
  MemoryExportEntry,
  MemoryExportFilters,
  MemoryExportFilterSummary,
  MemoryExportPhotoAttentionEntry,
  MemoryExportPrintReadiness,
  MemoryExportPrintReadinessSummary,
  MemoryExportSummary,
  MemoryExportTagSummary,
} from "@/types/export";

const EXPORT_SCHEMA_VERSION = "2026-07-phase16-v1" as const;

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

function getPrintReadinessLabel(readiness: MemoryExportPrintReadiness) {
  switch (readiness) {
    case "ready":
      return "Ready for book use";
    case "partial":
      return "Usable with caveats";
    case "text_only":
      return "Text only";
    case "needs_attention":
      return "Needs photo attention";
  }
}

function getPrintReadinessNote(memory: Memory, readiness: MemoryExportPrintReadiness) {
  switch (readiness) {
    case "ready":
      return "This memory includes at least one durable archive-backed photo reference for later book assembly.";
    case "partial":
      return "This memory includes photos, but some references still depend on a preserved copy or mixed durability states.";
    case "text_only":
      return memory.text.trim()
        ? "This memory has no attached photos, so it is ready as a text-only entry."
        : "This memory has no attached photos or saved body text yet.";
    case "needs_attention":
      return "This memory has photo references that are still pending NAS match, local-only, or missing from the archive.";
  }
}

function getMemoryPrintReadiness(memory: Memory) {
  const hasPhotos = memory.attachedPhotos.length > 0;
  const hasDurableNasPhoto = memory.attachedPhotos.some((photo) => photo.syncStatus === "linked_to_nas");
  const hasPendingNasMatchPhotos = memory.attachedPhotos.some(
    (photo) => photo.syncStatus === "pending_nas_match"
  );
  const hasMissingPhotos = memory.attachedPhotos.some((photo) => photo.syncStatus === "missing");
  const hasLocalOnlyPhotos = memory.attachedPhotos.some((photo) => photo.syncStatus === "local_only");
  const hasPreservedCopyPhotos = memory.attachedPhotos.some(
    (photo) => photo.syncStatus === "preserved_copy"
  );
  const hasOnlyPendingOrMissingPhotos =
    hasPhotos &&
    memory.attachedPhotos.every(
      (photo) => photo.syncStatus === "pending_nas_match" || photo.syncStatus === "missing"
    );

  let printReadiness: MemoryExportPrintReadiness;

  if (!hasPhotos) {
    printReadiness = "text_only";
  } else if (hasMissingPhotos || hasPendingNasMatchPhotos || hasLocalOnlyPhotos) {
    printReadiness = hasDurableNasPhoto || hasPreservedCopyPhotos ? "partial" : "needs_attention";
  } else if (hasPreservedCopyPhotos) {
    printReadiness = "partial";
  } else if (hasDurableNasPhoto) {
    printReadiness = "ready";
  } else {
    printReadiness = "needs_attention";
  }

  return {
    hasPhotos,
    hasDurableNasPhoto,
    hasOnlyPendingOrMissingPhotos,
    hasMissingPhotos,
    hasPendingNasMatchPhotos,
    printReadiness,
    printReadinessLabel: getPrintReadinessLabel(printReadiness),
    printReadinessNote: getPrintReadinessNote(memory, printReadiness),
  };
}

function mapMemoryToExportEntry(memory: Memory): MemoryExportEntry {
  const readiness = getMemoryPrintReadiness(memory);

  return {
    id: memory.id,
    date: memory.date,
    prompt: memory.prompt,
    text: memory.text,
    tags: memory.tags,
    collections: memory.collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      kind: collection.kind,
    })),
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
    hasPhotos: readiness.hasPhotos,
    hasDurableNasPhoto: readiness.hasDurableNasPhoto,
    hasOnlyPendingOrMissingPhotos: readiness.hasOnlyPendingOrMissingPhotos,
    hasMissingPhotos: readiness.hasMissingPhotos,
    hasPendingNasMatchPhotos: readiness.hasPendingNasMatchPhotos,
    printReadiness: readiness.printReadiness,
    printReadinessLabel: readiness.printReadinessLabel,
    printReadinessNote: readiness.printReadinessNote,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function buildExportSummary(memories: MemoryExportEntry[]): MemoryExportSummary {
  const summary: MemoryExportSummary = {
    memoryCount: memories.length,
    taggedMemoryCount: 0,
    untaggedMemoryCount: 0,
    memoryWithPhotosCount: 0,
    textOnlyMemoryCount: 0,
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
    } else {
      summary.untaggedMemoryCount += 1;
    }

    if (memory.photoManifest.length) {
      summary.memoryWithPhotosCount += 1;
    } else {
      summary.textOnlyMemoryCount += 1;
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

function buildDateRangeSummary(memories: MemoryExportEntry[]): MemoryExportDateRangeSummary {
  if (!memories.length) {
    return {
      earliestMemoryDate: null,
      latestMemoryDate: null,
      distinctYearCount: 0,
    };
  }

  const sortedDates = memories.map((memory) => memory.date).sort((left, right) => left.localeCompare(right));
  const distinctYears = new Set(
    memories.map((memory) => new Date(memory.date).getFullYear()).filter((year) => Number.isFinite(year))
  );

  return {
    earliestMemoryDate: sortedDates[0] ?? null,
    latestMemoryDate: sortedDates[sortedDates.length - 1] ?? null,
    distinctYearCount: distinctYears.size,
  };
}

function buildTagSummary(memories: MemoryExportEntry[]): MemoryExportTagSummary {
  const tagFrequency = new Map<string, number>();

  for (const memory of memories) {
    for (const tag of normalizeTagFilters(memory.tags)) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  const uniqueTags = [...tagFrequency.keys()].sort((left, right) => left.localeCompare(right));

  return {
    uniqueTags,
    tagFrequency: Object.fromEntries(
      uniqueTags.map((tag) => [tag, tagFrequency.get(tag) ?? 0] as const)
    ),
  };
}

function buildCollectionSummary(memories: MemoryExportEntry[]): MemoryExportCollectionSummary {
  const collectionFrequency = new Map<string, number>();

  for (const memory of memories) {
    for (const collection of memory.collections) {
      collectionFrequency.set(
        collection.title,
        (collectionFrequency.get(collection.title) ?? 0) + 1
      );
    }
  }

  const collectionTitles = [...collectionFrequency.keys()].sort((left, right) =>
    left.localeCompare(right)
  );

  return {
    collectionCount: collectionTitles.length,
    collectionFrequency: Object.fromEntries(
      collectionTitles.map((title) => [title, collectionFrequency.get(title) ?? 0] as const)
    ),
  };
}

function buildPrintReadinessSummary(
  memories: MemoryExportEntry[]
): MemoryExportPrintReadinessSummary {
  const summary: MemoryExportPrintReadinessSummary = {
    readyMemoryCount: 0,
    partialMemoryCount: 0,
    textOnlyMemoryCount: 0,
    needsAttentionMemoryCount: 0,
    memoriesWithDurablePhotosCount: 0,
    memoriesWithOnlyPendingOrMissingPhotosCount: 0,
    memoriesRequiringPhotoAttentionCount: 0,
  };

  for (const memory of memories) {
    switch (memory.printReadiness) {
      case "ready":
        summary.readyMemoryCount += 1;
        break;
      case "partial":
        summary.partialMemoryCount += 1;
        break;
      case "text_only":
        summary.textOnlyMemoryCount += 1;
        break;
      case "needs_attention":
        summary.needsAttentionMemoryCount += 1;
        break;
    }

    if (memory.hasDurableNasPhoto) {
      summary.memoriesWithDurablePhotosCount += 1;
    }

    if (memory.hasOnlyPendingOrMissingPhotos) {
      summary.memoriesWithOnlyPendingOrMissingPhotosCount += 1;
    }

    if (
      memory.hasMissingPhotos ||
      memory.hasPendingNasMatchPhotos ||
      memory.printReadiness === "needs_attention"
    ) {
      summary.memoriesRequiringPhotoAttentionCount += 1;
    }
  }

  return summary;
}

function buildPhotoAttentionRefs(
  memories: MemoryExportEntry[],
  syncStatus: "pending_nas_match" | "missing"
): MemoryExportPhotoAttentionEntry[] {
  const refs: MemoryExportPhotoAttentionEntry[] = [];

  for (const memory of memories) {
    for (const photo of memory.photoManifest) {
      if (photo.syncStatus !== syncStatus) {
        continue;
      }

      refs.push({
        memoryId: memory.id,
        memoryDate: memory.date,
        memoryPrompt: memory.prompt,
        photoId: photo.photoId,
        filename: photo.filename,
        path: photo.path,
        syncStatus: photo.syncStatus,
        syncStatusLabel: photo.syncStatusLabel,
        statusNote: photo.statusNote,
      });
    }
  }

  return refs;
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
    dateRangeSummary: buildDateRangeSummary(exportEntries),
    tagSummary: buildTagSummary(exportEntries),
    collectionSummary: buildCollectionSummary(exportEntries),
    printReadinessSummary: buildPrintReadinessSummary(exportEntries),
    pendingNasMatchRefs: buildPhotoAttentionRefs(exportEntries, "pending_nas_match"),
    missingPhotoRefs: buildPhotoAttentionRefs(exportEntries, "missing"),
    memories: exportEntries,
  };
}
