import type { PhotoProvider } from "@/services/photo/photoProvider";
import type { PhotoAsset } from "@/types/photo";

const REQUEST_TIMEOUT_MS = 5000;

type ConnectionTestResult = {
  ok: boolean;
  message: string;
  healthOk?: boolean;
  authValid?: boolean;
  serverStartedAt?: string | null;
  uptimeSeconds?: number;
  schedulerEnabled?: boolean;
  scheduledScanTime?: string | null;
  scheduledScanTimezone?: string | null;
  nextScheduledScanAt?: string | null;
  activeScanRunId?: string | null;
  scanInProgress?: boolean;
  indexedPhotoCount?: number;
  missingPhotoCount?: number;
  lastScanStartedAt?: string | null;
  lastScanFinishedAt?: string | null;
  lastScanStatus?: "success" | "failed" | "running" | null;
  rootReachable?: boolean;
};

function logWarning(message: string, extra?: unknown) {
  if (__DEV__) {
    console.warn(`[nasPhotoProvider] ${message}`, extra);
  }
}

function isValidSource(value: unknown): value is PhotoAsset["source"] {
  return value === "nas" || value === "local" || value === "mock";
}

function normalizePhotoAsset(input: unknown): PhotoAsset | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  if (
    typeof candidate.id !== "string" ||
    !isValidSource(candidate.source) ||
    typeof candidate.takenAt !== "string" ||
    typeof candidate.filename !== "string" ||
    typeof candidate.path !== "string" ||
    typeof candidate.thumbnailUrl !== "string" ||
    typeof candidate.viewUrl !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    source: candidate.source,
    takenAt: candidate.takenAt,
    filename: candidate.filename,
    path: candidate.path,
    thumbnailUrl: candidate.thumbnailUrl,
    viewUrl: candidate.viewUrl,
    contentHash:
      typeof candidate.contentHash === "string" ? candidate.contentHash : undefined,
    fileSize: typeof candidate.fileSize === "number" ? candidate.fileSize : undefined,
    width: typeof candidate.width === "number" ? candidate.width : undefined,
    height: typeof candidate.height === "number" ? candidate.height : undefined,
  };
}

async function fetchWithTimeout(input: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithoutAuth(input: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function testNasPhotoConnection(
  baseUrl: string,
  apiKey: string,
  date: string
): Promise<ConnectionTestResult> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (!normalizedBaseUrl || !apiKey) {
    return {
      ok: false,
      message: "NAS mode is missing the API base URL or API key.",
      healthOk: false,
      authValid: false,
    };
  }

  try {
    const healthResponse = await fetchWithoutAuth(`${normalizedBaseUrl}/health`);

    if (!healthResponse.ok) {
      return {
        ok: false,
        message: `Photo API health check returned HTTP ${healthResponse.status}.`,
        healthOk: false,
        authValid: false,
      };
    }

    const statusResponse = await fetchWithTimeout(`${normalizedBaseUrl}/status`, apiKey);

    if (statusResponse.status === 401) {
      return {
        ok: false,
        message: "Invalid NAS Photo API key.",
        healthOk: true,
        authValid: false,
      };
    }

    if (!statusResponse.ok) {
      return {
        ok: false,
        message: `Photo API status check returned HTTP ${statusResponse.status}.`,
        healthOk: true,
        authValid: false,
      };
    }

    const statusPayload = (await statusResponse.json()) as Record<string, unknown>;

    if (
      typeof statusPayload.indexedPhotoCount !== "number" ||
      typeof statusPayload.missingPhotoCount !== "number" ||
      typeof statusPayload.rootReachable !== "boolean"
    ) {
      return {
        ok: false,
        message: "Photo API status returned an invalid response shape.",
        healthOk: true,
        authValid: true,
      };
    }

    const photosResponse = await fetchWithTimeout(
      `${normalizedBaseUrl}/photos?date=${encodeURIComponent(date)}`,
      apiKey
    );

    if (!photosResponse.ok) {
      return {
        ok: false,
        message: `Photo API date lookup returned HTTP ${photosResponse.status}.`,
        healthOk: true,
        authValid: true,
        indexedPhotoCount: statusPayload.indexedPhotoCount,
        missingPhotoCount: statusPayload.missingPhotoCount,
        serverStartedAt:
          typeof statusPayload.serverStartedAt === "string"
            ? statusPayload.serverStartedAt
            : null,
        uptimeSeconds:
          typeof statusPayload.uptimeSeconds === "number"
            ? statusPayload.uptimeSeconds
            : undefined,
        schedulerEnabled:
          typeof statusPayload.schedulerEnabled === "boolean"
            ? statusPayload.schedulerEnabled
            : undefined,
        scheduledScanTime:
          typeof statusPayload.scheduledScanTime === "string"
            ? statusPayload.scheduledScanTime
            : null,
        scheduledScanTimezone:
          typeof statusPayload.scheduledScanTimezone === "string"
            ? statusPayload.scheduledScanTimezone
            : null,
        nextScheduledScanAt:
          typeof statusPayload.nextScheduledScanAt === "string"
            ? statusPayload.nextScheduledScanAt
            : null,
        activeScanRunId:
          typeof statusPayload.activeScanRunId === "string"
            ? statusPayload.activeScanRunId
            : null,
        scanInProgress:
          typeof statusPayload.scanInProgress === "boolean"
            ? statusPayload.scanInProgress
            : undefined,
        lastScanStartedAt:
          typeof statusPayload.lastScanStartedAt === "string"
            ? statusPayload.lastScanStartedAt
            : null,
        lastScanFinishedAt:
          typeof statusPayload.lastScanFinishedAt === "string"
            ? statusPayload.lastScanFinishedAt
            : null,
        lastScanStatus:
          statusPayload.lastScanStatus === "success" ||
          statusPayload.lastScanStatus === "failed" ||
          statusPayload.lastScanStatus === "running"
            ? statusPayload.lastScanStatus
            : null,
        rootReachable: statusPayload.rootReachable,
      };
    }

    const payload = (await photosResponse.json()) as unknown;
    const photoCount = Array.isArray(payload) ? payload.length : 0;

    return {
      ok: true,
      message: `Photo API reachable. Indexed ${statusPayload.indexedPhotoCount} photo(s). Today's query returned ${photoCount}.`,
      healthOk: true,
      authValid: true,
      indexedPhotoCount: statusPayload.indexedPhotoCount,
      missingPhotoCount: statusPayload.missingPhotoCount,
      serverStartedAt:
        typeof statusPayload.serverStartedAt === "string"
          ? statusPayload.serverStartedAt
          : null,
      uptimeSeconds:
        typeof statusPayload.uptimeSeconds === "number"
          ? statusPayload.uptimeSeconds
          : undefined,
      schedulerEnabled:
        typeof statusPayload.schedulerEnabled === "boolean"
          ? statusPayload.schedulerEnabled
          : undefined,
      scheduledScanTime:
        typeof statusPayload.scheduledScanTime === "string"
          ? statusPayload.scheduledScanTime
          : null,
      scheduledScanTimezone:
        typeof statusPayload.scheduledScanTimezone === "string"
          ? statusPayload.scheduledScanTimezone
          : null,
      nextScheduledScanAt:
        typeof statusPayload.nextScheduledScanAt === "string"
          ? statusPayload.nextScheduledScanAt
          : null,
      activeScanRunId:
        typeof statusPayload.activeScanRunId === "string"
          ? statusPayload.activeScanRunId
          : null,
      scanInProgress:
        typeof statusPayload.scanInProgress === "boolean"
          ? statusPayload.scanInProgress
          : undefined,
      lastScanStartedAt:
        typeof statusPayload.lastScanStartedAt === "string"
          ? statusPayload.lastScanStartedAt
          : null,
      lastScanFinishedAt:
        typeof statusPayload.lastScanFinishedAt === "string"
          ? statusPayload.lastScanFinishedAt
          : null,
      lastScanStatus:
        statusPayload.lastScanStatus === "success" ||
        statusPayload.lastScanStatus === "failed" ||
        statusPayload.lastScanStatus === "running"
          ? statusPayload.lastScanStatus
          : null,
      rootReachable: statusPayload.rootReachable,
    };
  } catch (error) {
    logWarning("NAS connection test failed.", error);
    return {
      ok: false,
      message: "Cannot reach Photo API.",
      healthOk: false,
      authValid: false,
    };
  }
}

export function createNasPhotoProvider(baseUrl: string, apiKey: string): PhotoProvider {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async getPhotosByDate(date: string) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for date lookup.");
        return [];
      }

      try {
        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/photos?date=${encodeURIComponent(date)}`,
          apiKey
        );

        if (response.status === 401) {
          logWarning("Date lookup was unauthorized.");
          return [];
        }

        if (!response.ok) {
          logWarning(`Date lookup failed with status ${response.status}.`);
          return [];
        }

        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) {
          logWarning("Date lookup returned a non-array payload.", payload);
          return [];
        }

        return payload
          .map((item) => normalizePhotoAsset(item))
          .filter((item): item is PhotoAsset => item !== null);
      } catch (error) {
        logWarning("Date lookup request failed.", error);
        return [];
      }
    },

    async getPhotoById(photoId: string) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for photo lookup.");
        return null;
      }

      try {
        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/photos/${encodeURIComponent(photoId)}`,
          apiKey
        );

        if (response.status === 404) {
          return null;
        }

        if (response.status === 401) {
          logWarning("Photo lookup was unauthorized.", photoId);
          return null;
        }

        if (!response.ok) {
          logWarning(`Photo lookup failed with status ${response.status}.`, photoId);
          return null;
        }

        const payload = (await response.json()) as unknown;
        const normalizedPhoto = normalizePhotoAsset(payload);

        if (!normalizedPhoto) {
          logWarning("Photo lookup returned invalid payload.", payload);
        }

        return normalizedPhoto;
      } catch (error) {
        logWarning("Photo lookup request failed.", error);
        return null;
      }
    },
  };
}
