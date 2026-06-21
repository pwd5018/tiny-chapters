export type AttachedPhotoSource = "nas" | "local" | "mock";

export type AttachedPhotoRef = {
  photoId: string;
  source: AttachedPhotoSource;
  path: string;
  attachedAt: string;
  contentHash?: string;
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
