import type { PhotoProvider } from "@/services/photo/photoProvider";
import type {
  FolderEntry,
  FolderPhotosResult,
  PagedPhotoResult,
  PhotoAsset,
  PhotoPagingParams,
  PhotoSearchParams,
} from "@/types/photo";

const mockPhotos: PhotoAsset[] = [
  {
    id: "photo-2026-06-12-1",
    source: "mock",
    takenAt: "2026-06-12T18:55:00.000Z",
    filename: "whisper-dog.jpg",
    path: "/nas/family/2026/06/12/whisper-dog.jpg",
    thumbnailUrl: "https://picsum.photos/seed/tinychapters-0612a/200/200",
    viewUrl: "https://picsum.photos/seed/tinychapters-0612a/800/600",
    contentHash: "mockhash-whisper-dog",
    fileSize: 248190,
    width: 1600,
    height: 1200,
  },
  {
    id: "photo-2026-06-12-2",
    source: "mock",
    takenAt: "2026-06-12T20:10:00.000Z",
    filename: "couch-giggles.jpg",
    path: "/nas/family/2026/06/12/couch-giggles.jpg",
    thumbnailUrl: "https://picsum.photos/seed/tinychapters-0612b/200/200",
    viewUrl: "https://picsum.photos/seed/tinychapters-0612b/800/600",
    fileSize: 312540,
    width: 1536,
    height: 1024,
  },
  {
    id: "photo-2026-06-11-1",
    source: "mock",
    takenAt: "2026-06-11T12:58:00.000Z",
    filename: "rain-window.jpg",
    path: "/nas/family/2026/06/11/rain-window.jpg",
    thumbnailUrl: "https://picsum.photos/seed/tinychapters-0611a/200/200",
    viewUrl: "https://picsum.photos/seed/tinychapters-0611a/800/600",
    width: 1440,
    height: 1080,
  },
  {
    id: "photo-2026-06-09-1",
    source: "mock",
    takenAt: "2026-06-09T22:35:00.000Z",
    filename: "bedtime-lamp.jpg",
    path: "/nas/family/2026/06/09/bedtime-lamp.jpg",
    thumbnailUrl: "https://picsum.photos/seed/tinychapters-0609a/200/200",
    viewUrl: "https://picsum.photos/seed/tinychapters-0609a/800/600",
    fileSize: 221440,
    width: 1200,
    height: 1600,
  },
];

function toDateKey(isoString: string) {
  return isoString.slice(0, 10);
}

function paginatePhotos(photos: PhotoAsset[], paging?: PhotoPagingParams): PagedPhotoResult {
  const limit = Math.max(1, paging?.limit ?? 50);
  const offset = Math.max(0, paging?.offset ?? 0);
  const items = photos.slice(offset, offset + limit);

  return {
    items,
    limit,
    offset,
    total: photos.length,
    hasMore: offset + items.length < photos.length,
  };
}

function getFolderEntries(): FolderEntry[] {
  return [
    { name: "family", path: "family" },
    { name: "2026", path: "family/2026" },
    { name: "06", path: "family/2026/06" },
    { name: "12", path: "family/2026/06/12" },
    { name: "11", path: "family/2026/06/11" },
    { name: "09", path: "family/2026/06/09" },
  ];
}

export const mockPhotoProvider: PhotoProvider = {
  getCapabilities() {
    return {
      supportsDateLookup: true,
      supportsSearch: true,
      supportsFolders: true,
      supportsRelinkMatching: false,
      requiresPermission: false,
    };
  },

  async getPhotosByDate(date: string) {
    return mockPhotos.filter((photo) => toDateKey(photo.takenAt) === date);
  },

  async getPhotoById(photoId: string) {
    return mockPhotos.find((photo) => photo.id === photoId) ?? null;
  },

  async matchPhotoCandidate() {
    return null;
  },

  async searchPhotos(params: PhotoSearchParams) {
    const normalizedQuery = params.q?.trim().toLowerCase() ?? "";
    const filtered = mockPhotos
      .filter((photo) => {
        const localDate = toDateKey(photo.takenAt);

        if (params.date && localDate !== params.date) {
          return false;
        }

        if (params.from && localDate < params.from) {
          return false;
        }

        if (params.to && localDate > params.to) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          photo.filename.toLowerCase().includes(normalizedQuery) ||
          photo.path.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => right.takenAt.localeCompare(left.takenAt));

    return paginatePhotos(filtered, params);
  },

  async getFolders(folderPath = "") {
    const normalizedPath = folderPath.replace(/^\/+|\/+$/g, "");
    const folders = getFolderEntries().filter((entry) => {
      if (!normalizedPath) {
        return !entry.path.includes("/");
      }

      if (!entry.path.startsWith(`${normalizedPath}/`)) {
        return false;
      }

      const remainder = entry.path.slice(normalizedPath.length + 1);
      return remainder.length > 0 && !remainder.includes("/");
    });

    return {
      path: normalizedPath,
      parentPath: normalizedPath ? normalizedPath.split("/").slice(0, -1).join("/") || null : null,
      folders,
    };
  },

  async getFolderPhotos(folderPath: string, paging?: PhotoPagingParams): Promise<FolderPhotosResult> {
    const normalizedPath = folderPath.replace(/^\/+|\/+$/g, "");
    const filtered = mockPhotos
      .filter((photo) =>
        normalizedPath ? photo.path.toLowerCase().includes(`/${normalizedPath.toLowerCase()}/`) : true
      )
      .sort((left, right) => right.takenAt.localeCompare(left.takenAt));
    const page = paginatePhotos(filtered, paging);

    return {
      path: normalizedPath,
      ...page,
    };
  },
};
