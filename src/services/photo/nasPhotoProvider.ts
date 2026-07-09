import type { PhotoProvider } from "@/services/photo/photoProvider";
import type {
  FolderPhotosResult,
  FolderResult,
  PagedPhotoResult,
  PhotoAsset,
  PhotoMatchCandidate,
  PhotoMatchDiagnosticCandidate,
  PhotoMatchDiagnosticResult,
  PhotoPagingParams,
  PhotoSearchParams,
} from "@/types/photo";

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
  return value === "nas" || value === "mock" || value === "device";
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

function normalizePagedPhotoResult(input: unknown): PagedPhotoResult | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (
    !Array.isArray(candidate.items) ||
    typeof candidate.limit !== "number" ||
    typeof candidate.offset !== "number" ||
    typeof candidate.total !== "number" ||
    typeof candidate.hasMore !== "boolean"
  ) {
    return null;
  }

  return {
    items: candidate.items
      .map((item) => normalizePhotoAsset(item))
      .filter((item): item is PhotoAsset => item !== null),
    limit: candidate.limit,
    offset: candidate.offset,
    total: candidate.total,
    hasMore: candidate.hasMore,
  };
}

function normalizeFolderResult(input: unknown): FolderResult | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.path !== "string" ||
    (candidate.parentPath !== null && typeof candidate.parentPath !== "string") ||
    !Array.isArray(candidate.folders)
  ) {
    return null;
  }

  const folders = candidate.folders.filter(
    (item): item is FolderResult["folders"][number] =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).name === "string" &&
          typeof (item as Record<string, unknown>).path === "string"
      )
  );

  return {
    path: candidate.path,
    parentPath: candidate.parentPath,
    folders,
  };
}

function normalizeFolderPhotosResult(input: unknown): FolderPhotosResult | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const paged = normalizePagedPhotoResult(candidate);

  if (!paged || typeof candidate.path !== "string") {
    return null;
  }

  return {
    path: candidate.path,
    ...paged,
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

export async function inspectNasPhotoMatchCandidate(
  baseUrl: string,
  apiKey: string,
  candidate: PhotoMatchCandidate
): Promise<PhotoMatchDiagnosticResult> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  if (!normalizedBaseUrl || !apiKey) {
    return {
      status: "unavailable",
      message: "NAS mode is missing the API base URL or API key.",
    };
  }

  try {
    const query = new URLSearchParams();

    if (candidate.filename) {
      query.set("filename", candidate.filename);
    }
    if (candidate.takenAt) {
      query.set("takenAt", candidate.takenAt);
    }
    if (typeof candidate.fileSize === "number") {
      query.set("fileSize", String(candidate.fileSize));
    }
    if (typeof candidate.width === "number") {
      query.set("width", String(candidate.width));
    }
    if (typeof candidate.height === "number") {
      query.set("height", String(candidate.height));
    }
    if (typeof candidate.toleranceMinutes === "number") {
      query.set("toleranceMinutes", String(candidate.toleranceMinutes));
    }

    const response = await fetchWithTimeout(
      `${normalizedBaseUrl}/photos/match?${query.toString()}`,
      apiKey
    );

    if (response.status === 401) {
      return {
        status: "unauthorized",
        message: "NAS Photo API key was rejected during photo-match diagnostics.",
      };
    }

    if (response.status === 404) {
      return {
        status: "no_match",
        message: "No confident NAS match was found for this photo candidate.",
      };
    }

    if (response.status === 409) {
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const candidates: PhotoMatchDiagnosticCandidate[] = Array.isArray(payload?.candidates)
        ? payload.candidates
            .map((entry) => {
              if (!entry || typeof entry !== "object") {
                return null;
              }

              const candidateRecord = entry as Record<string, unknown>;
              const normalizedPhoto = normalizePhotoAsset(candidateRecord.photo);
              const confidence =
                typeof candidateRecord.confidence === "number"
                  ? candidateRecord.confidence
                  : null;

              if (!normalizedPhoto || confidence === null) {
                return null;
              }

              return {
                confidence,
                photo: normalizedPhoto,
              };
            })
            .filter(
              (entry): entry is PhotoMatchDiagnosticCandidate => entry !== null
            )
        : [];

      return {
        status: "ambiguous",
        message: candidates.length
          ? "Multiple NAS candidates were too close to call safely."
          : "The NAS matcher reported an ambiguous result.",
        candidates,
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: `Photo-match diagnostics returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const matchedPhoto = normalizePhotoAsset(payload.photo);

    if (!matchedPhoto) {
      return {
        status: "error",
        message: "Photo-match diagnostics returned an invalid match payload.",
      };
    }

    return {
      status: "matched",
      message: "A confident NAS photo match was found.",
      confidence: typeof payload.confidence === "number" ? payload.confidence : undefined,
      matchedPhoto,
    };
  } catch (error) {
    logWarning("Photo match diagnostics request failed.", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Photo-match diagnostics failed.",
    };
  }
}

export function createNasPhotoProvider(baseUrl: string, apiKey: string): PhotoProvider {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    getCapabilities() {
      return {
        supportsDateLookup: true,
        supportsSearch: true,
        supportsFolders: true,
        supportsRelinkMatching: true,
        requiresPermission: false,
      };
    },

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

    async matchPhotoCandidate(candidate: PhotoMatchCandidate) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for photo matching.");
        return null;
      }

      try {
        const query = new URLSearchParams();

        if (candidate.filename) {
          query.set("filename", candidate.filename);
        }
        if (candidate.takenAt) {
          query.set("takenAt", candidate.takenAt);
        }
        if (typeof candidate.fileSize === "number") {
          query.set("fileSize", String(candidate.fileSize));
        }
        if (typeof candidate.width === "number") {
          query.set("width", String(candidate.width));
        }
        if (typeof candidate.height === "number") {
          query.set("height", String(candidate.height));
        }
        if (typeof candidate.toleranceMinutes === "number") {
          query.set("toleranceMinutes", String(candidate.toleranceMinutes));
        }

        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/photos/match?${query.toString()}`,
          apiKey
        );

        if (response.status === 401) {
          logWarning("Photo match request was unauthorized.", candidate);
          return null;
        }

        if (response.status === 404 || response.status === 409) {
          return null;
        }

        if (!response.ok) {
          logWarning(`Photo match failed with status ${response.status}.`, candidate);
          return null;
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const normalizedPhoto = normalizePhotoAsset(payload.photo);

        if (!normalizedPhoto) {
          logWarning("Photo match returned invalid payload.", payload);
          return null;
        }

        return normalizedPhoto;
      } catch (error) {
        logWarning("Photo match request failed.", error);
        return null;
      }
    },

    async searchPhotos(params: PhotoSearchParams) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for photo search.");
        return {
          items: [],
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          total: 0,
          hasMore: false,
        };
      }

      try {
        const query = new URLSearchParams();

        if (params.q?.trim()) {
          query.set("q", params.q.trim());
        }
        if (params.date) {
          query.set("date", params.date);
        }
        if (params.from) {
          query.set("from", params.from);
        }
        if (params.to) {
          query.set("to", params.to);
        }
        if (typeof params.limit === "number") {
          query.set("limit", String(params.limit));
        }
        if (typeof params.offset === "number") {
          query.set("offset", String(params.offset));
        }

        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/photos/search?${query.toString()}`,
          apiKey
        );

        if (response.status === 401) {
          logWarning("Photo search request was unauthorized.", params);
          return {
            items: [],
            limit: params.limit ?? 50,
            offset: params.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        if (!response.ok) {
          logWarning(`Photo search failed with status ${response.status}.`, params);
          return {
            items: [],
            limit: params.limit ?? 50,
            offset: params.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        const payload = normalizePagedPhotoResult(await response.json());
        if (!payload) {
          logWarning("Photo search returned invalid payload.", params);
          return {
            items: [],
            limit: params.limit ?? 50,
            offset: params.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        return payload;
      } catch (error) {
        logWarning("Photo search request failed.", error);
        return {
          items: [],
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          total: 0,
          hasMore: false,
        };
      }
    },

    async getFolders(folderPath?: string) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for folder lookup.");
        return {
          path: folderPath ?? "",
          parentPath: null,
          folders: [],
        };
      }

      try {
        const query = new URLSearchParams();
        if (folderPath?.trim()) {
          query.set("path", folderPath.trim());
        }

        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/folders?${query.toString()}`,
          apiKey
        );

        if (response.status === 401) {
          logWarning("Folder lookup was unauthorized.", folderPath);
          return {
            path: folderPath ?? "",
            parentPath: null,
            folders: [],
          };
        }

        if (!response.ok) {
          logWarning(`Folder lookup failed with status ${response.status}.`, folderPath);
          return {
            path: folderPath ?? "",
            parentPath: null,
            folders: [],
          };
        }

        const payload = normalizeFolderResult(await response.json());
        if (!payload) {
          logWarning("Folder lookup returned invalid payload.", folderPath);
          return {
            path: folderPath ?? "",
            parentPath: null,
            folders: [],
          };
        }

        return payload;
      } catch (error) {
        logWarning("Folder lookup request failed.", error);
        return {
          path: folderPath ?? "",
          parentPath: null,
          folders: [],
        };
      }
    },

    async getFolderPhotos(folderPath: string, paging?: PhotoPagingParams) {
      if (!normalizedBaseUrl || !apiKey) {
        logWarning("Missing NAS base URL or API key for folder photos.");
        return {
          path: folderPath,
          items: [],
          limit: paging?.limit ?? 50,
          offset: paging?.offset ?? 0,
          total: 0,
          hasMore: false,
        };
      }

      try {
        const query = new URLSearchParams();
        query.set("path", folderPath);
        if (typeof paging?.limit === "number") {
          query.set("limit", String(paging.limit));
        }
        if (typeof paging?.offset === "number") {
          query.set("offset", String(paging.offset));
        }

        const response = await fetchWithTimeout(
          `${normalizedBaseUrl}/folder-photos?${query.toString()}`,
          apiKey
        );

        if (response.status === 401) {
          logWarning("Folder photos lookup was unauthorized.", folderPath);
          return {
            path: folderPath,
            items: [],
            limit: paging?.limit ?? 50,
            offset: paging?.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        if (!response.ok) {
          logWarning(`Folder photos failed with status ${response.status}.`, folderPath);
          return {
            path: folderPath,
            items: [],
            limit: paging?.limit ?? 50,
            offset: paging?.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        const payload = normalizeFolderPhotosResult(await response.json());
        if (!payload) {
          logWarning("Folder photos returned invalid payload.", folderPath);
          return {
            path: folderPath,
            items: [],
            limit: paging?.limit ?? 50,
            offset: paging?.offset ?? 0,
            total: 0,
            hasMore: false,
          };
        }

        return payload;
      } catch (error) {
        logWarning("Folder photos request failed.", error);
        return {
          path: folderPath,
          items: [],
          limit: paging?.limit ?? 50,
          offset: paging?.offset ?? 0,
          total: 0,
          hasMore: false,
        };
      }
    },
  };
}
