import Constants from "expo-constants";

export type AppEnvironment = "development" | "production";
export type AppRuntime = "expo-go" | "development-build" | "standalone";
export type PhotoSourceMode = "mock" | "nas" | "device";
export type NetworkTarget =
  | "not-configured"
  | "localhost"
  | "lan"
  | "tailscale"
  | "custom";
export type NasPhotoApiNetworkTarget = NetworkTarget;

function readPublicEnvValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function resolveAppEnvironment(rawValue: string): AppEnvironment {
  return rawValue.toLowerCase() === "production" ? "production" : "development";
}

function resolvePhotoSourceMode(rawValue: string): PhotoSourceMode {
  switch (rawValue.toLowerCase()) {
    case "nas":
      return "nas";
    case "device":
      return "device";
    default:
      return "mock";
  }
}

function parseUrlSafely(value: string) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function normalizeUrlLikeValue(value: string) {
  const trimmedValue = readPublicEnvValue(value).replace(/\/+$/, "");

  if (!trimmedValue) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `http://${trimmedValue}`;
}

function isLocalhostHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

function isPrivateLanIpv4(hostname: string) {
  return (
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
  );
}

function isTailscaleIpv4(hostname: string) {
  const match = hostname.match(/^100\.(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 64 && secondOctet <= 127;
}

const rawAppEnvironment = readPublicEnvValue(process.env.EXPO_PUBLIC_APP_ENV);
const rawPhotoSourceMode = readPublicEnvValue(process.env.EXPO_PUBLIC_PHOTO_SOURCE_MODE).toLowerCase();

export const appEnvironment = resolveAppEnvironment(rawAppEnvironment);
export const supabaseUrl = readPublicEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = readPublicEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
export const nasPhotoApiBaseUrl = readPublicEnvValue(
  process.env.EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL
).replace(/\/+$/, "");
export const nasPhotoApiKey = readPublicEnvValue(process.env.EXPO_PUBLIC_NAS_PHOTO_API_KEY);
export const photoSourceMode: PhotoSourceMode = resolvePhotoSourceMode(rawPhotoSourceMode);

export function isNasPhotoApiConfigured() {
  return Boolean(nasPhotoApiBaseUrl && nasPhotoApiKey);
}

export function getNasPhotoApiNetworkTarget(
  baseUrl: string = nasPhotoApiBaseUrl
): NasPhotoApiNetworkTarget {
  const normalizedBaseUrl = normalizeUrlLikeValue(baseUrl);

  if (!normalizedBaseUrl) {
    return "not-configured";
  }

  const parsedUrl = parseUrlSafely(normalizedBaseUrl);

  if (!parsedUrl) {
    return "custom";
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (isLocalhostHostname(hostname)) {
    return "localhost";
  }

  if (isPrivateLanIpv4(hostname) || hostname.endsWith(".local")) {
    return "lan";
  }

  if (isTailscaleIpv4(hostname) || hostname.endsWith(".ts.net")) {
    return "tailscale";
  }

  return "custom";
}

export function getNetworkTargetLabel(
  target: NetworkTarget
) {
  switch (target) {
    case "localhost":
      return "Localhost only";
    case "lan":
      return "LAN";
    case "tailscale":
      return "Tailscale";
    case "custom":
      return "Custom";
    default:
      return "Not configured";
  }
}

export function getNasPhotoApiNetworkTargetLabel(
  target: NasPhotoApiNetworkTarget = getNasPhotoApiNetworkTarget()
) {
  return getNetworkTargetLabel(target);
}

export function getMetroDevServerHostUri() {
  return readPublicEnvValue(
    Constants.expoConfig?.hostUri ??
      Constants.platform?.hostUri ??
      undefined
  );
}

export function getMetroDevServerUrl() {
  return normalizeUrlLikeValue(getMetroDevServerHostUri());
}

export function getMetroDevServerNetworkTarget(
  hostUri: string = getMetroDevServerHostUri()
): NetworkTarget {
  const normalizedHostUri = normalizeUrlLikeValue(hostUri);

  if (!normalizedHostUri) {
    return "not-configured";
  }

  const parsedUrl = parseUrlSafely(normalizedHostUri);

  if (!parsedUrl) {
    return "custom";
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (isLocalhostHostname(hostname)) {
    return "localhost";
  }

  if (isPrivateLanIpv4(hostname) || hostname.endsWith(".local")) {
    return "lan";
  }

  if (isTailscaleIpv4(hostname) || hostname.endsWith(".ts.net")) {
    return "tailscale";
  }

  return "custom";
}

export function getMetroDevServerNetworkTargetLabel(
  target: NetworkTarget = getMetroDevServerNetworkTarget()
) {
  return getNetworkTargetLabel(target);
}

export function getAppRuntime(): AppRuntime {
  if (Constants.executionEnvironment === "storeClient") {
    return "expo-go";
  }

  if (__DEV__) {
    return "development-build";
  }

  return "standalone";
}

export function isExpoGoRuntime() {
  return getAppRuntime() === "expo-go";
}

export function isDevelopmentBuildRuntime() {
  return getAppRuntime() === "development-build";
}

export function getAppRuntimeLabel() {
  switch (getAppRuntime()) {
    case "expo-go":
      return "Expo Go";
    case "development-build":
      return "Development Build";
    default:
      return "Standalone App";
  }
}

export function getAppEnvironmentLabel() {
  return appEnvironment === "production" ? "Production" : "Development";
}
