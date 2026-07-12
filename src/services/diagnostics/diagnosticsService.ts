import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  getAppEnvironmentLabel,
  getAppRuntimeLabel,
  getMetroDevServerNetworkTargetLabel,
  getMetroDevServerUrl,
  getNasPhotoApiNetworkTarget,
  getNasPhotoApiNetworkTargetLabel,
  nasPhotoApiBaseUrl,
  nasPhotoApiKey,
  supabaseUrl,
  type NasPhotoApiNetworkTarget,
} from "@/config/appConfig";
import { getCurrentSession, getCurrentUser } from "@/services/auth/authService";
import {
  getReminderSettings,
  getNextReminderDate,
  getScheduledReminderCount,
  isReminderNotificationsSupported,
  sendTestMemoryReminder,
} from "@/services/notifications/reminderService";
import {
  getCameraPermissionStatus,
  getMediaLibraryPermissionStatus,
  getNotificationPermissionStatus,
  type AppPermissionStatus,
} from "@/services/permissions/permissionService";
import {
  getPhotoDurabilitySummary,
  inspectPendingNasMatchRefs,
  retryPendingNasMatches,
  type NasRelinkSummary,
  type PendingNasMatchDiagnostic,
} from "@/services/photo/photoRelinkService";
import { getActivePhotoSourceMode, isNasPhotoMatchingAvailable } from "@/services/photo/photoService";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { maskToken, maskUrl, maskUserId } from "@/services/diagnostics/masking";

const DEVELOPER_MODE_KEY = "tiny_chapters.developer_mode_enabled";
const DIAGNOSTICS_EVENTS_KEY = "tiny_chapters.diagnostics_events";
const MAX_DIAGNOSTICS_EVENTS = 50;
const REQUEST_TIMEOUT_MS = 5000;

export type DiagnosticsEvent = {
  id: string;
  timestamp: string;
  category: "developer" | "supabase" | "nas" | "relink" | "notifications";
  level: "info" | "success" | "error";
  title: string;
  detail?: string;
};

export type DiagnosticsSnapshot = {
  app: {
    version: string;
    runtimeEnvironment: string;
    photoSourceMode: string;
    metroDevServerUrl: string;
    metroDevServerNetworkTarget: string;
    nasPhotoApiBaseUrl: string;
    nasPhotoApiNetworkTarget: string;
    supabaseUrl: string;
    platform: string;
    expoOwnership: string;
    isDev: boolean;
  };
  supabase: {
    configured: boolean;
    authenticated: boolean;
    email: string;
    maskedUserId: string;
  };
};

export type SupabaseDiagnosticsResult = {
  ok: boolean;
  message: string;
  authenticated: boolean;
  email: string;
  maskedUserId: string;
};

export type NasHealthResult = {
  ok: boolean;
  message: string;
  service?: string;
  version?: string;
};

export type NasStatusResult = {
  ok: boolean;
  message: string;
  authValid: boolean;
  indexedPhotoCount?: number;
  missingPhotoCount?: number;
  rootReachable?: boolean;
  schedulerEnabled?: boolean;
  nextScheduledScanAt?: string | null;
  scanInProgress?: boolean;
  lastScanStatus?: string | null;
  lastScanFinishedAt?: string | null;
};

export type NotificationDiagnostics = {
  supported: boolean;
  permissionStatus: string;
  remindersEnabled: boolean;
  cadence: string;
  time: string;
  promptStyle: string;
  nextReminderTimestamp: number | null;
  scheduledNotificationCount: number;
};

export type IosReadinessDiagnostics = {
  platform: string;
  bundleIdentifier: string;
  notificationPermissionStatus: string;
  cameraPermissionStatus: AppPermissionStatus;
  mediaLibraryPermissionStatus: AppPermissionStatus;
  photoSourceMode: string;
  photoApiUrl: string;
  photoApiNetworkTarget: string;
  remoteAccessGuidance: string;
  localhostWarning: string | null;
  lanWarning: string | null;
  customUrlWarning: string | null;
  insecureHttpWarning: string | null;
  localUriRiskNote: string;
};

export type StartupDiagnosticsSummary = {
  environment: string;
  runtime: string;
  photoSource: string;
  platform: string;
  supabaseReachable: boolean;
  photoApiReachable: boolean | null;
  notificationPermission: string;
  pendingNasMatches: number;
};

export type PendingNasMatchDiagnosticsResult = {
  inspected: number;
  items: PendingNasMatchDiagnostic[];
};

function createEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readDiagnosticsEvents() {
  const raw = await AsyncStorage.getItem(DIAGNOSTICS_EVENTS_KEY);

  if (!raw) {
    return [] as DiagnosticsEvent[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as DiagnosticsEvent[];
    }

    return parsed.filter(
      (item): item is DiagnosticsEvent =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as DiagnosticsEvent).id === "string" &&
            typeof (item as DiagnosticsEvent).timestamp === "string" &&
            typeof (item as DiagnosticsEvent).category === "string" &&
            typeof (item as DiagnosticsEvent).level === "string" &&
            typeof (item as DiagnosticsEvent).title === "string"
        )
    );
  } catch {
    return [] as DiagnosticsEvent[];
  }
}

async function fetchWithTimeout(input: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getBundleIdentifier() {
  return (
    Constants.expoConfig?.ios?.bundleIdentifier ??
    Constants.expoConfig?.android?.package ??
    "Unavailable"
  );
}

function parseUrlSafely(value: string) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function isLocalhostHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

function getNasPhotoApiGuidance(target: NasPhotoApiNetworkTarget) {
  switch (target) {
    case "localhost":
      return "Invalid for phone testing. Point the app at the Windows host using LAN or Tailscale instead.";
    case "lan":
      return "Best for home-network testing. Switch this same base URL to a Tailscale-reachable host when testing away from home.";
    case "tailscale":
      return "Preferred personal remote-access path. Keep the same Photo API and port without opening router ports.";
    case "custom":
      return "Allowed, but outside the default LAN or Tailscale setup this phase is optimizing for.";
    default:
      return "Configure EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL with a phone-reachable LAN or Tailscale address.";
  }
}

export async function isDeveloperModeEnabled() {
  return (await AsyncStorage.getItem(DEVELOPER_MODE_KEY)) === "true";
}

export async function enableDeveloperMode() {
  await AsyncStorage.setItem(DEVELOPER_MODE_KEY, "true");
  await addDiagnosticsEvent({
    category: "developer",
    level: "success",
    title: "Developer Mode enabled",
    detail: "Hidden diagnostics were unlocked on this device.",
  });
}

export async function disableDeveloperMode() {
  await AsyncStorage.setItem(DEVELOPER_MODE_KEY, "false");
  await addDiagnosticsEvent({
    category: "developer",
    level: "info",
    title: "Developer Mode disabled",
    detail: "Hidden diagnostics were turned off on this device.",
  });
}

export async function getDiagnosticsSnapshot(): Promise<DiagnosticsSnapshot> {
  const session = isSupabaseConfigured ? await getCurrentSession().catch(() => null) : null;
  const user = isSupabaseConfigured ? await getCurrentUser().catch(() => null) : null;
  const networkTarget = getNasPhotoApiNetworkTarget();
  const metroDevServerUrl = getMetroDevServerUrl();

  return {
    app: {
      version: Constants.expoConfig?.version ?? "Unknown",
      runtimeEnvironment: String(Constants.executionEnvironment ?? "unknown"),
      photoSourceMode: getActivePhotoSourceMode(),
      metroDevServerUrl: metroDevServerUrl || "Unavailable",
      metroDevServerNetworkTarget: getMetroDevServerNetworkTargetLabel(),
      nasPhotoApiBaseUrl: maskUrl(nasPhotoApiBaseUrl),
      nasPhotoApiNetworkTarget: getNasPhotoApiNetworkTargetLabel(networkTarget),
      supabaseUrl: maskUrl(supabaseUrl),
      platform: Platform.OS,
      expoOwnership: String(Constants.appOwnership ?? "unknown"),
      isDev: __DEV__,
    },
    supabase: {
      configured: isSupabaseConfigured,
      authenticated: Boolean(session && user),
      email: user?.email ?? "No active session",
      maskedUserId: maskUserId(user?.id),
    },
  };
}

async function checkSupabaseReachableForStartup() {
  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.from("memories").select("id", { head: true, count: "exact" }).limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkPhotoApiReachableForStartup() {
  if (!isNasPhotoMatchingAvailable() || !nasPhotoApiBaseUrl) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(`${nasPhotoApiBaseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function runStartupDiagnosticsIfDeveloperMode() {
  if (!(await isDeveloperModeEnabled())) {
    return null;
  }

  try {
    const [supabaseReachable, photoApiReachable, notificationPermission, durabilitySummary] =
      await Promise.all([
        checkSupabaseReachableForStartup(),
        checkPhotoApiReachableForStartup(),
        getNotificationPermissionStatus().catch(() => "undetermined"),
        getPhotoDurabilitySummary().catch(() => ({
          pendingNasMatches: 0,
          linkedNasPhotos: 0,
          missingPhotos: 0,
        })),
      ]);

    const summary: StartupDiagnosticsSummary = {
      environment: getAppEnvironmentLabel(),
      runtime: getAppRuntimeLabel(),
      photoSource: getActivePhotoSourceMode(),
      platform: Platform.OS,
      supabaseReachable,
      photoApiReachable,
      notificationPermission,
      pendingNasMatches: durabilitySummary.pendingNasMatches,
    };

    const detail =
      `env=${summary.environment} | runtime=${summary.runtime} | photoSource=${summary.photoSource} | ` +
      `supabaseReachable=${summary.supabaseReachable ? "yes" : "no"} | ` +
      `photoApiReachable=${summary.photoApiReachable === null ? "n/a" : summary.photoApiReachable ? "yes" : "no"} | ` +
      `notificationPermission=${summary.notificationPermission} | ` +
      `pendingNasMatches=${summary.pendingNasMatches} | platform=${summary.platform}`;

    if (__DEV__) {
      console.log("[tiny-chapters] Startup diagnostics", summary);
    }

    await addDiagnosticsEvent({
      category: "developer",
      level: "info",
      title: "Startup diagnostics captured",
      detail,
    });

    return summary;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup diagnostics error.";

    if (__DEV__) {
      console.warn("[tiny-chapters] Startup diagnostics failed", error);
    }

    await addDiagnosticsEvent({
      category: "developer",
      level: "error",
      title: "Startup diagnostics failed",
      detail: message,
    });

    return null;
  }
}

export async function testSupabaseConnection(): Promise<SupabaseDiagnosticsResult> {
  if (!isSupabaseConfigured) {
    const result = {
      ok: false,
      message: "Supabase is not configured.",
      authenticated: false,
      email: "No active session",
      maskedUserId: "Unavailable",
    };
    await addDiagnosticsEvent({
      category: "supabase",
      level: "error",
      title: "Supabase test failed",
      detail: result.message,
    });
    return result;
  }

  try {
    const client = getSupabaseClient();
    const user = await getCurrentUser().catch(() => null);
    const { error } = await client.from("memories").select("id", { head: true, count: "exact" }).limit(1);

    if (error) {
      throw error;
    }

    const result = {
      ok: true,
      message: user
        ? "Supabase query succeeded with the current signed-in user."
        : "Supabase responded, but there is no active signed-in user.",
      authenticated: Boolean(user),
      email: user?.email ?? "No active session",
      maskedUserId: maskUserId(user?.id),
    };
    await addDiagnosticsEvent({
      category: "supabase",
      level: "success",
      title: "Supabase test succeeded",
      detail: result.message,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error.";
    await addDiagnosticsEvent({
      category: "supabase",
      level: "error",
      title: "Supabase test failed",
      detail: message,
    });
    return {
      ok: false,
      message,
      authenticated: false,
      email: "Unknown",
      maskedUserId: "Unavailable",
    };
  }
}

export async function testNasHealth(): Promise<NasHealthResult> {
  const baseUrl = nasPhotoApiBaseUrl.replace(/\/+$/, "");

  if (!baseUrl) {
    const result = {
      ok: false,
      message: "NAS Photo API base URL is not configured.",
    };
    await addDiagnosticsEvent({
      category: "nas",
      level: "error",
      title: "NAS health test failed",
      detail: result.message,
    });
    return result;
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const result = {
      ok: true,
      message: "NAS Photo API health check succeeded.",
      service: typeof payload.service === "string" ? payload.service : undefined,
      version: typeof payload.version === "string" ? payload.version : undefined,
    };
    await addDiagnosticsEvent({
      category: "nas",
      level: "success",
      title: "NAS health test succeeded",
      detail: `${maskUrl(baseUrl)} responded successfully.`,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown NAS health error.";
    await addDiagnosticsEvent({
      category: "nas",
      level: "error",
      title: "NAS health test failed",
      detail: message,
    });
    return {
      ok: false,
      message,
    };
  }
}

export async function testNasStatus(): Promise<NasStatusResult> {
  const baseUrl = nasPhotoApiBaseUrl.replace(/\/+$/, "");

  if (!baseUrl) {
    const result = {
      ok: false,
      message: "NAS Photo API base URL is not configured.",
      authValid: false,
    };
    await addDiagnosticsEvent({
      category: "nas",
      level: "error",
      title: "NAS status test failed",
      detail: result.message,
    });
    return result;
  }

  if (!nasPhotoApiKey) {
    const result = {
      ok: false,
      message: "NAS Photo API key is missing.",
      authValid: false,
    };
    await addDiagnosticsEvent({
      category: "nas",
      level: "error",
      title: "NAS status test failed",
      detail: "NAS Photo API key is missing.",
    });
    return result;
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/status`, {
      Authorization: `Bearer ${nasPhotoApiKey}`,
    });

    if (response.status === 401) {
      const result = {
        ok: false,
        message: "NAS Photo API key was rejected.",
        authValid: false,
      };
      await addDiagnosticsEvent({
        category: "nas",
        level: "error",
        title: "NAS status auth failed",
        detail: "The configured NAS Photo API key was rejected.",
      });
      return result;
    }

    if (!response.ok) {
      throw new Error(`Status returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const result = {
      ok: true,
      message: "NAS Photo API status check succeeded.",
      authValid: true,
      indexedPhotoCount:
        typeof payload.indexedPhotoCount === "number" ? payload.indexedPhotoCount : undefined,
      missingPhotoCount:
        typeof payload.missingPhotoCount === "number" ? payload.missingPhotoCount : undefined,
      rootReachable:
        typeof payload.rootReachable === "boolean" ? payload.rootReachable : undefined,
      schedulerEnabled:
        typeof payload.schedulerEnabled === "boolean" ? payload.schedulerEnabled : undefined,
      nextScheduledScanAt:
        typeof payload.nextScheduledScanAt === "string" ? payload.nextScheduledScanAt : null,
      scanInProgress:
        typeof payload.scanInProgress === "boolean" ? payload.scanInProgress : undefined,
      lastScanStatus:
        typeof payload.lastScanStatus === "string" ? payload.lastScanStatus : null,
      lastScanFinishedAt:
        typeof payload.lastScanFinishedAt === "string" ? payload.lastScanFinishedAt : null,
    };
    await addDiagnosticsEvent({
      category: "nas",
      level: "success",
      title: "NAS status test succeeded",
      detail: `Indexed ${result.indexedPhotoCount ?? 0} photo(s). Root reachable: ${result.rootReachable ? "yes" : "no"}.`,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown NAS status error.";
    await addDiagnosticsEvent({
      category: "nas",
      level: "error",
      title: "NAS status test failed",
      detail: message,
    });
    return {
      ok: false,
      message,
      authValid: false,
    };
  }
}

export async function getPhotoDurabilityCounts() {
  return getPhotoDurabilitySummary();
}

export async function runRelinkRetry(): Promise<NasRelinkSummary> {
  try {
    const summary = await retryPendingNasMatches();
    await addDiagnosticsEvent({
      category: "relink",
      level: "success",
      title: "Relink retry finished",
      detail: `Checked ${summary.checked}. Matched ${summary.matched}. Still pending ${summary.stillPending}. Errors ${summary.errors}.`,
    });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown relink error.";
    await addDiagnosticsEvent({
      category: "relink",
      level: "error",
      title: "Relink retry failed",
      detail: message,
    });
    throw error;
  }
}

export async function getPendingNasMatchDiagnostics(
  limit = 5
): Promise<PendingNasMatchDiagnosticsResult> {
  const items = await inspectPendingNasMatchRefs({ limit });

  await addDiagnosticsEvent({
    category: "relink",
    level: "info",
    title: "Pending NAS match diagnostics captured",
    detail: `Inspected ${items.length} pending photo reference${items.length === 1 ? "" : "s"}.`,
  });

  return {
    inspected: items.length,
    items,
  };
}

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const settings = await getReminderSettings();
  const permissionStatus = await getNotificationPermissionStatus().catch(() => "undetermined");
  const nextReminderTimestamp = await getNextReminderDate(settings).catch(() => null);
  const scheduledNotificationCount = await getScheduledReminderCount().catch(() => 0);

  return {
    supported: isReminderNotificationsSupported(),
    permissionStatus,
    remindersEnabled: settings.enabled,
    cadence: settings.cadence,
    time: settings.time,
    promptStyle: settings.promptStyle,
    nextReminderTimestamp,
    scheduledNotificationCount,
  };
}

export async function getIosReadinessDiagnostics(): Promise<IosReadinessDiagnostics> {
  const parsedUrl = parseUrlSafely(nasPhotoApiBaseUrl);
  const isIos = Platform.OS === "ios";
  const photoSourceMode = getActivePhotoSourceMode();
  const networkTarget = getNasPhotoApiNetworkTarget();

  const [notificationPermissionStatus, cameraPermissionStatus, mediaLibraryPermissionStatus] =
    await Promise.all([
      getNotificationPermissionStatus().catch(() => "undetermined"),
      getCameraPermissionStatus().catch(() => "undetermined" as const),
      getMediaLibraryPermissionStatus().catch(() => "undetermined" as const),
    ]);

  return {
    platform: Platform.OS,
    bundleIdentifier: getBundleIdentifier(),
    notificationPermissionStatus,
    cameraPermissionStatus,
    mediaLibraryPermissionStatus,
    photoSourceMode,
    photoApiUrl: nasPhotoApiBaseUrl || "Not configured",
    photoApiNetworkTarget: getNasPhotoApiNetworkTargetLabel(networkTarget),
    remoteAccessGuidance: getNasPhotoApiGuidance(networkTarget),
    localhostWarning:
      isIos && parsedUrl && isLocalhostHostname(parsedUrl.hostname)
        ? "This Photo API URL points at localhost, which would refer to the iPhone itself."
        : null,
    lanWarning:
      isIos && networkTarget === "lan"
        ? "This URL looks LAN-only. It should work on the same home network, but not as a remote-away-from-home path."
        : null,
    customUrlWarning:
      isIos && networkTarget === "custom"
        ? "This URL is outside the default LAN or Tailscale patterns, so verify iPhone reachability directly."
        : null,
    insecureHttpWarning:
      isIos && isNasPhotoMatchingAvailable() && parsedUrl?.protocol === "http:"
        ? "NAS mode is using HTTP. Validate iPhone reachability first, then review HTTPS or trusted-network expectations later."
        : null,
    localUriRiskNote:
      "Phone-local asset URIs are temporary, device-specific, and still need real iPhone validation for preview and relink behavior.",
  };
}

export async function runNotificationTest() {
  const settings = await getReminderSettings();
  const result = await sendTestMemoryReminder(settings.promptStyle);

  await addDiagnosticsEvent({
    category: "notifications",
    level: result ? "success" : "info",
    title: result ? "Test notification scheduled" : "Test notification skipped",
    detail: result
      ? "A local reminder was scheduled for about 5 seconds from now."
      : "Notifications are unavailable or permission is not granted.",
  });

  return result;
}

export async function addDiagnosticsEvent(
  input: Omit<DiagnosticsEvent, "id" | "timestamp">
) {
  const nextEvent: DiagnosticsEvent = {
    id: createEventId(),
    timestamp: new Date().toISOString(),
    ...input,
  };

  const current = await readDiagnosticsEvents();
  const next = [nextEvent, ...current].slice(0, MAX_DIAGNOSTICS_EVENTS);
  await AsyncStorage.setItem(DIAGNOSTICS_EVENTS_KEY, JSON.stringify(next));
}

export async function getRecentDiagnosticsEvents() {
  return readDiagnosticsEvents();
}

export async function clearDiagnosticsEvents() {
  await AsyncStorage.setItem(DIAGNOSTICS_EVENTS_KEY, JSON.stringify([]));
}

export { maskToken, maskUrl, maskUserId };
