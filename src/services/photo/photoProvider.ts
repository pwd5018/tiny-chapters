import type {
  FolderPhotosResult,
  FolderResult,
  PagedPhotoResult,
  PhotoAsset,
  PhotoProviderCapabilities,
  PhotoMatchCandidate,
  PhotoPagingParams,
  PhotoSearchParams,
} from "@/types/photo";

export interface PhotoProvider {
  getCapabilities(): PhotoProviderCapabilities;
  getPhotosByDate(date: string): Promise<PhotoAsset[]>;
  getPhotoById(photoId: string): Promise<PhotoAsset | null>;
  matchPhotoCandidate(candidate: PhotoMatchCandidate): Promise<PhotoAsset | null>;
  searchPhotos(params: PhotoSearchParams): Promise<PagedPhotoResult>;
  getFolders(path?: string): Promise<FolderResult>;
  getFolderPhotos(path: string, paging?: PhotoPagingParams): Promise<FolderPhotosResult>;
}
