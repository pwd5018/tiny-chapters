export type SupportedSource = "nas";
export type ScanMode = "incremental" | "full";

export type PhotoAssetRecord = {
  id: string;
  content_hash: string;
  current_path: string;
  filename: string;
  taken_at: string;
  last_modified_at: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  thumbnail_path: string | null;
  is_missing: number;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
};

export type ScanSummary = {
  scanned: number;
  inserted: number;
  updated: number;
  missing: number;
  errors: number;
};

export type ScanRunRecord = {
  id: string;
  mode: ScanMode;
  started_at: string;
  finished_at: string | null;
  status: "success" | "failed" | "running";
  scanned: number;
  inserted: number;
  updated: number;
  missing: number;
  errors: number;
  error_message: string | null;
};

export type ApiPhotoAsset = {
  id: string;
  source: SupportedSource;
  takenAt: string;
  filename: string;
  path: string;
  thumbnailUrl: string;
  viewUrl: string;
  contentHash: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

export type PhotoSearchParams = {
  q?: string;
  date?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export type PagedPhotoResponse = {
  items: ApiPhotoAsset[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type FolderEntry = {
  name: string;
  path: string;
};

export type FolderResponse = {
  path: string;
  parentPath: string | null;
  folders: FolderEntry[];
};

export type FolderPhotosResponse = PagedPhotoResponse & {
  path: string;
};

export type PhotoMatchCandidate = {
  filename?: string;
  takenAt?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  toleranceMinutes?: number;
};

export type PhotoMatchResult = {
  matched: boolean;
  confidence?: number;
  photo?: ApiPhotoAsset;
  candidates?: Array<{
    confidence: number;
    photo: ApiPhotoAsset;
  }>;
};

export type StatusPayload = {
  status: "ok";
  serverStartedAt: string;
  uptimeSeconds: number;
  schedulerEnabled: boolean;
  scheduledScanTime: string | null;
  scheduledScanTimezone: string | null;
  nextScheduledScanAt: string | null;
  activeScanRunId: string | null;
  scanInProgress: boolean;
  indexedPhotoCount: number;
  missingPhotoCount: number;
  lastScanStartedAt: string | null;
  lastScanFinishedAt: string | null;
  lastScanStatus: "success" | "failed" | "running" | null;
  lastScanSummary: ScanSummary | null;
  photoLibraryRoot: string;
  thumbnailCacheDir: string;
  databasePath: string;
  rootReachable: boolean;
};
