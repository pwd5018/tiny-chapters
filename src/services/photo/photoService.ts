import {
  isNasPhotoApiConfigured,
  nasPhotoApiBaseUrl,
  nasPhotoApiKey,
  photoSourceMode,
  type PhotoSourceMode,
} from "@/config/photoSourceConfig";
import { mockPhotoProvider } from "@/services/photo/mockPhotoProvider";
import {
  createNasPhotoProvider,
  testNasPhotoConnection,
} from "@/services/photo/nasPhotoProvider";

const nasPhotoProvider = createNasPhotoProvider(nasPhotoApiBaseUrl, nasPhotoApiKey);

function getActiveProvider() {
  if (photoSourceMode === "nas" && isNasPhotoApiConfigured()) {
    return nasPhotoProvider;
  }

  return mockPhotoProvider;
}

export async function getPhotosByDate(date: string) {
  return getActiveProvider().getPhotosByDate(date);
}

export async function getPhotoById(photoId: string) {
  return getActiveProvider().getPhotoById(photoId);
}

export function getActivePhotoSourceMode(): PhotoSourceMode {
  if (photoSourceMode === "nas" && isNasPhotoApiConfigured()) {
    return "nas";
  }

  return "mock";
}

export function getNasPhotoApiBaseUrl() {
  return nasPhotoApiBaseUrl;
}

export function getNasPhotoApiKeyConfigured() {
  return Boolean(nasPhotoApiKey);
}

export async function testPhotoConnection(date: string) {
  if (getActivePhotoSourceMode() === "mock") {
    return {
      ok: true,
      message: "Mock provider is active and responding.",
    };
  }

  return testNasPhotoConnection(nasPhotoApiBaseUrl, nasPhotoApiKey, date);
}

export async function loadPhotosForDate(date: string) {
  const mode = getActivePhotoSourceMode();

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
