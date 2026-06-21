import type { PhotoProvider } from "@/services/photo/photoProvider";
import type { PhotoAsset } from "@/types/photo";

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

export const mockPhotoProvider: PhotoProvider = {
  async getPhotosByDate(date: string) {
    return mockPhotos.filter((photo) => toDateKey(photo.takenAt) === date);
  },

  async getPhotoById(photoId: string) {
    return mockPhotos.find((photo) => photo.id === photoId) ?? null;
  },
};
