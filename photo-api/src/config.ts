import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

export type AiProviderName = "openai" | "groq" | "gemini";

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

function readOptionalEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function readAiProvider() {
  const rawValue = readOptionalEnv("AI_PROVIDER").toLowerCase();

  if (rawValue === "openai" || rawValue === "groq" || rawValue === "gemini") {
    return rawValue;
  }

  return null;
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
  aiProvider: readAiProvider(),
  openAiApiKey: readOptionalEnv("OPENAI_API_KEY"),
  openAiModel: readOptionalEnv("OPENAI_MODEL"),
  groqApiKey: readOptionalEnv("GROQ_API_KEY"),
  groqModel: readOptionalEnv("GROQ_MODEL"),
  geminiApiKey: readOptionalEnv("GEMINI_API_KEY"),
  geminiModel: readOptionalEnv("GEMINI_MODEL"),
};

export const supportedExtensions = ["jpg", "jpeg", "png", "heic", "webp"];
