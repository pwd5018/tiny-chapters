import type { AttachedPhotoSource, AttachedPhotoSyncStatus, MemoryGuidanceContext } from "@/types/memory";

export type MemoryExportPhotoManifestEntry = {
  photoId: string;
  source: AttachedPhotoSource;
  path: string;
  filename: string | null;
  contentHash: string | null;
  takenAt: string | null;
  attachedAt: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  syncStatus: AttachedPhotoSyncStatus;
  syncStatusLabel: string;
  sourceLabel: string;
  statusNote: string;
  localUriIncluded: boolean;
};

export type MemoryExportPrintReadiness = "ready" | "partial" | "text_only" | "needs_attention";

export type MemoryExportPhotoAttentionEntry = {
  memoryId: string;
  memoryDate: string;
  memoryPrompt: string;
  photoId: string;
  filename: string | null;
  path: string;
  syncStatus: AttachedPhotoSyncStatus;
  syncStatusLabel: string;
  statusNote: string;
};

export type MemoryExportEntry = {
  id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext: MemoryGuidanceContext | null;
  attachedPhotoCount: number;
  photoManifest: MemoryExportPhotoManifestEntry[];
  hasPhotos: boolean;
  hasDurableNasPhoto: boolean;
  hasOnlyPendingOrMissingPhotos: boolean;
  hasMissingPhotos: boolean;
  hasPendingNasMatchPhotos: boolean;
  printReadiness: MemoryExportPrintReadiness;
  printReadinessLabel: string;
  printReadinessNote: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryExportFilters = {
  from?: string | null;
  to?: string | null;
  tags?: string[];
};

export type MemoryExportFilterSummary = {
  from: string | null;
  to: string | null;
  tags: string[];
};

export type MemoryExportSummary = {
  memoryCount: number;
  taggedMemoryCount: number;
  untaggedMemoryCount: number;
  memoryWithPhotosCount: number;
  textOnlyMemoryCount: number;
  totalPhotoReferences: number;
  linkedNasPhotoCount: number;
  pendingNasMatchCount: number;
  localOnlyPhotoCount: number;
  missingPhotoCount: number;
  preservedCopyPhotoCount: number;
};

export type MemoryExportDateRangeSummary = {
  earliestMemoryDate: string | null;
  latestMemoryDate: string | null;
  distinctYearCount: number;
};

export type MemoryExportTagSummary = {
  uniqueTags: string[];
  tagFrequency: Record<string, number>;
};

export type MemoryExportPrintReadinessSummary = {
  readyMemoryCount: number;
  partialMemoryCount: number;
  textOnlyMemoryCount: number;
  needsAttentionMemoryCount: number;
  memoriesWithDurablePhotosCount: number;
  memoriesWithOnlyPendingOrMissingPhotosCount: number;
  memoriesRequiringPhotoAttentionCount: number;
};

export type MemoryArchiveExport = {
  schemaVersion: "2026-07-phase13-v2";
  exportType: "tiny-chapters-archive";
  exportedAt: string;
  filters: MemoryExportFilterSummary;
  summary: MemoryExportSummary;
  dateRangeSummary: MemoryExportDateRangeSummary;
  tagSummary: MemoryExportTagSummary;
  printReadinessSummary: MemoryExportPrintReadinessSummary;
  pendingNasMatchRefs: MemoryExportPhotoAttentionEntry[];
  missingPhotoRefs: MemoryExportPhotoAttentionEntry[];
  memories: MemoryExportEntry[];
};
