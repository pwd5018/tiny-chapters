export type PhotoSourceMode = "mock" | "nas";

const rawMode = process.env.EXPO_PUBLIC_PHOTO_SOURCE_MODE?.trim().toLowerCase();

export const photoSourceMode: PhotoSourceMode =
  rawMode === "nas" ? "nas" : "mock";

export const nasPhotoApiBaseUrl =
  process.env.EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL?.trim() ?? "";

export const nasPhotoApiKey =
  process.env.EXPO_PUBLIC_NAS_PHOTO_API_KEY?.trim() ?? "";

export function isNasPhotoApiConfigured() {
  return photoSourceMode === "nas" && Boolean(nasPhotoApiBaseUrl && nasPhotoApiKey);
}
