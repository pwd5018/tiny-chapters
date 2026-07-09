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

export type MemoryExportEntry = {
  id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext: MemoryGuidanceContext | null;
  attachedPhotoCount: number;
  photoManifest: MemoryExportPhotoManifestEntry[];
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
  memoryWithPhotosCount: number;
  totalPhotoReferences: number;
  linkedNasPhotoCount: number;
  pendingNasMatchCount: number;
  localOnlyPhotoCount: number;
  missingPhotoCount: number;
  preservedCopyPhotoCount: number;
};

export type MemoryArchiveExport = {
  schemaVersion: "2026-07-phase13-v1";
  exportType: "tiny-chapters-archive";
  exportedAt: string;
  filters: MemoryExportFilterSummary;
  summary: MemoryExportSummary;
  memories: MemoryExportEntry[];
};
