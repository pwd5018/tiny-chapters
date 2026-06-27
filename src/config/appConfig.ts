import Constants from "expo-constants";

export type AppEnvironment = "development" | "production";
export type AppRuntime = "expo-go" | "development-build" | "standalone";
export type PhotoSourceMode = "mock" | "nas";

function readPublicEnvValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function resolveAppEnvironment(rawValue: string): AppEnvironment {
  return rawValue.toLowerCase() === "production" ? "production" : "development";
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
export const photoSourceMode: PhotoSourceMode = rawPhotoSourceMode === "nas" ? "nas" : "mock";

export function isNasPhotoApiConfigured() {
  return photoSourceMode === "nas" && Boolean(nasPhotoApiBaseUrl && nasPhotoApiKey);
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
