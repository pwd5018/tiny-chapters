import {
  isNasPhotoApiConfigured,
  nasPhotoApiBaseUrl,
  nasPhotoApiKey,
  photoSourceMode,
  type PhotoSourceMode,
} from "@/config/photoSourceConfig";
import { devicePhotoProvider } from "@/services/photo/devicePhotoProvider";
import { mockPhotoProvider } from "@/services/photo/mockPhotoProvider";
import {
  createNasPhotoProvider,
  inspectNasPhotoMatchCandidate,
  testNasPhotoConnection,
} from "@/services/photo/nasPhotoProvider";
import type {
  PhotoBrowseSource,
  PhotoProviderCapabilities,
  PhotoMatchCandidate,
  PhotoMatchDiagnosticResult,
  PhotoPagingParams,
  PhotoSearchParams,
} from "@/types/photo";

const nasPhotoProvider = createNasPhotoProvider(nasPhotoApiBaseUrl, nasPhotoApiKey);

function getActiveProvider() {
  switch (getActivePhotoSourceMode()) {
    case "nas":
      return nasPhotoProvider;
    case "device":
      return devicePhotoProvider;
    default:
      return mockPhotoProvider;
  }
}

export async function getPhotosByDate(date: string) {
  return getActiveProvider().getPhotosByDate(date);
}

export async function getPhotoById(photoId: string) {
  return getActiveProvider().getPhotoById(photoId);
}

export function getPhotoPreviewUrls(photoId: string) {
  if (getActivePhotoSourceMode() !== "nas" || !nasPhotoApiBaseUrl) {
    return null;
  }

  const encodedPhotoId = encodeURIComponent(photoId);
  return {
    thumbnailUrl: `${nasPhotoApiBaseUrl.replace(/\/+$/, "")}/photos/${encodedPhotoId}/thumb`,
    viewUrl: `${nasPhotoApiBaseUrl.replace(/\/+$/, "")}/photos/${encodedPhotoId}/view`,
  };
}

export function getActivePhotoSourceMode(): PhotoSourceMode {
  if (photoSourceMode === "device") {
    return "device";
  }

  if (photoSourceMode === "nas" && isNasPhotoApiConfigured()) {
    return "nas";
  }

  return "mock";
}

export function getPhotoSourceCapabilities(
  source: PhotoBrowseSource = getActivePhotoSourceMode()
): PhotoProviderCapabilities {
  switch (source) {
    case "nas":
      return nasPhotoProvider.getCapabilities();
    case "device":
      return devicePhotoProvider.getCapabilities();
    default:
      return mockPhotoProvider.getCapabilities();
  }
}

export function getNasPhotoApiBaseUrl() {
  return nasPhotoApiBaseUrl;
}

export function getNasPhotoApiKeyConfigured() {
  return Boolean(nasPhotoApiKey);
}

export function isNasPhotoMatchingAvailable() {
  return isNasPhotoApiConfigured();
}

export async function testPhotoConnection(date: string) {
  switch (getActivePhotoSourceMode()) {
    case "mock":
      return {
        ok: true,
        message: "Mock provider is active and responding.",
      };
    case "device":
      return {
        ok: true,
        message:
          "Device photo-source groundwork is active. Shared library browsing will land in the next slice.",
      };
    default:
      return testNasPhotoConnection(nasPhotoApiBaseUrl, nasPhotoApiKey, date);
  }
}

export async function loadPhotosForDate(date: string) {
  const mode = getActivePhotoSourceMode();
  const capabilities = getPhotoSourceCapabilities(mode);

  if (!capabilities.supportsDateLookup) {
    return {
      photos: [],
      mode,
      message:
        mode === "device"
          ? "Device-library browsing is reserved for the shared picker work in the next slice."
          : "This photo source does not support date browsing yet.",
      ok: true,
    };
  }

  if (mode === "mock") {
    const photos = await getPhotosByDate(date);
    return {
      photos,
      mode,
      message: photos.length ? "" : "No mock photos available for this day yet.",
      ok: true,
    };
  }

  const connection = await testPhotoConnection(date);
  if (!connection.ok) {
    return {
      photos: [],
      mode,
      message: `${connection.message} Falling back gracefully with no photos.`,
      ok: false,
    };
  }

  const photos = await getPhotosByDate(date);
  return {
    photos,
    mode,
    message: photos.length ? "" : "NAS photo source responded, but no photos were found for this day.",
    ok: true,
  };
}

export async function matchPhotoCandidate(candidate: PhotoMatchCandidate) {
  if (!isNasPhotoMatchingAvailable()) {
    return null;
  }

  return nasPhotoProvider.matchPhotoCandidate(candidate);
}

export async function inspectPhotoMatchCandidate(
  candidate: PhotoMatchCandidate
): Promise<PhotoMatchDiagnosticResult> {
  if (!isNasPhotoMatchingAvailable()) {
    return {
      status: "unavailable",
      message: "NAS photo matching is not configured right now.",
    };
  }

  return inspectNasPhotoMatchCandidate(nasPhotoApiBaseUrl, nasPhotoApiKey, candidate);
}

export async function getFolders(path?: string) {
  return getActiveProvider().getFolders(path);
}

export async function getFolderPhotos(path: string, paging?: PhotoPagingParams) {
  return getActiveProvider().getFolderPhotos(path, paging);
}

export async function searchPhotos(params: PhotoSearchParams) {
  return getActiveProvider().searchPhotos(params);
}

export function getPhotoImageSource(uri: string) {
  if (
    isNasPhotoApiConfigured() &&
    nasPhotoApiKey &&
    nasPhotoApiBaseUrl &&
    uri.startsWith(nasPhotoApiBaseUrl)
  ) {
    return {
      uri,
      headers: {
        Authorization: `Bearer ${nasPhotoApiKey}`,
      },
    };
  }

  return { uri };
}
