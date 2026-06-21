import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readBooleanEnv(name: string, fallback = false) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  return rawValue.toLowerCase() === "true";
}

export const config = {
  port: Number(process.env.PORT ?? "5055"),
  photoLibraryRoot: requireEnv("PHOTO_LIBRARY_ROOT"),
  photoApiKey: requireEnv("PHOTO_API_KEY"),
  enableScheduledScan: readBooleanEnv("ENABLE_SCHEDULED_SCAN", false),
  scheduledScanTime: process.env.SCHEDULED_SCAN_TIME ?? null,
  scheduledScanTimezone: process.env.SCHEDULED_SCAN_TIMEZONE ?? null,
  thumbnailCacheDir: path.resolve(
    process.cwd(),
    process.env.THUMBNAIL_CACHE_DIR ?? "./cache/thumbnails"
  ),
  databasePath: path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH ?? "./data/photo-index.sqlite"
  ),
};

export const supportedExtensions = ["jpg", "jpeg", "png", "heic", "webp"];
