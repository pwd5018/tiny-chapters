import type { PhotoProvider } from "@/services/photo/photoProvider";
import type { FolderPhotosResult, FolderResult, PhotoPagingParams } from "@/types/photo";

function createEmptyFolderPhotosResult(
  path: string,
  paging?: PhotoPagingParams
): FolderPhotosResult {
  return {
    path,
    items: [],
    limit: paging?.limit ?? 50,
    offset: paging?.offset ?? 0,
    total: 0,
    hasMore: false,
  };
}

export const devicePhotoProvider: PhotoProvider = {
  getCapabilities() {
    return {
      supportsDateLookup: false,
      supportsSearch: false,
      supportsFolders: false,
      supportsRelinkMatching: false,
      requiresPermission: true,
    };
  },

  async getPhotosByDate() {
    return [];
  },

  async getPhotoById() {
    return null;
  },

  async matchPhotoCandidate() {
    return null;
  },

  async searchPhotos(params) {
    return {
      items: [],
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      total: 0,
      hasMore: false,
    };
  },

  async getFolders(path = ""): Promise<FolderResult> {
    return {
      path,
      parentPath: null,
      folders: [],
    };
  },

  async getFolderPhotos(path: string, paging?: PhotoPagingParams): Promise<FolderPhotosResult> {
    return createEmptyFolderPhotosResult(path, paging);
  },
};
