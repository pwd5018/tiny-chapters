export type AttachedPhotoSource = "nas" | "local" | "mock";
export type AttachedPhotoSyncStatus =
  | "local_only"
  | "pending_nas_match"
  | "linked_to_nas"
  | "missing"
  | "preserved_copy";

export type AttachedPhotoRef = {
  photoId: string;
  source: AttachedPhotoSource;
  path: string;
  attachedAt: string;
  contentHash?: string;
  filename?: string;
  takenAt?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  localUri?: string;
  syncStatus: AttachedPhotoSyncStatus;
};

export type Memory = {
  id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  attachedPhotos: AttachedPhotoRef[];
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoryInput = {
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  attachedPhotos: AttachedPhotoRef[];
};
