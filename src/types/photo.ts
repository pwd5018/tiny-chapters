import type { AttachedPhotoSource } from "@/types/memory";

export type PhotoAsset = {
  id: string;
  source: AttachedPhotoSource;
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

export type PhotoSearchResult = {
  date: string;
  photos: PhotoAsset[];
};
