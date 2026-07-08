export type PhotoBrowseSource = "mock" | "nas" | "device";
export type PhotoAssetSource = "mock" | "nas" | "device";

export type PhotoProviderCapabilities = {
  supportsDateLookup: boolean;
  supportsSearch: boolean;
  supportsFolders: boolean;
  supportsRelinkMatching: boolean;
  requiresPermission: boolean;
};

export type PhotoAsset = {
  id: string;
  source: PhotoAssetSource;
  takenAt: string;
  filename: string;
  path: string;
  thumbnailUrl: string;
  viewUrl: string;
  contentHash?: string;
  fileSize?: number;
  width?: number;
  height?: number;
};

export type PhotoMatchCandidate = {
  filename?: string;
  takenAt?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  toleranceMinutes?: number;
};

export type PhotoSearchResult = {
  date: string;
  photos: PhotoAsset[];
};

export type PhotoSearchParams = {
  q?: string;
  date?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type PhotoPagingParams = {
  limit?: number;
  offset?: number;
};

export type PagedPhotoResult = {
  items: PhotoAsset[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type FolderEntry = {
  name: string;
  path: string;
};

export type FolderResult = {
  path: string;
  parentPath: string | null;
  folders: FolderEntry[];
};

export type FolderPhotosResult = PagedPhotoResult & {
  path: string;
};
