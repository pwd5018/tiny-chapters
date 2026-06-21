import type { PhotoAsset } from "@/types/photo";

export interface PhotoProvider {
  getPhotosByDate(date: string): Promise<PhotoAsset[]>;
  getPhotoById(photoId: string): Promise<PhotoAsset | null>;
}
