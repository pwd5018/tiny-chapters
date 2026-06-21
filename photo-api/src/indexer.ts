import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import exifr from "exifr";
import fg from "fast-glob";
import mime from "mime-types";
import sharp from "sharp";

import { config, supportedExtensions } from "./config";
import {
  createScanRun,
  finishScanRun,
  getAllPhotoIds,
  getPhotoByHash,
  getPhotoByPath,
  markPhotoMissing,
  touchPhotoSeen,
  updateScanRunProgress,
  upsertPhoto,
} from "./db";
import { logError, logInfo, logWarn } from "./logger";
import { endScanLock, isScanRunning, startScanLock } from "./runtime";
import { checkPhotoRootReachable, logPhotoRootStatus } from "./fsChecks";
import type { PhotoAssetRecord, ScanMode, ScanRunRecord, ScanSummary } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function newScanRunId() {
  return crypto.randomUUID();
}

const PROGRESS_FLUSH_INTERVAL = 100;

async function sha256ForFile(filePath: string) {
  const hash = crypto.createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });

  return hash.digest("hex");
}

async function getTakenAt(filePath: string, stats: fs.Stats) {
  try {
    const exifDate = await exifr.parse(filePath, ["DateTimeOriginal"]);
    if (exifDate?.DateTimeOriginal instanceof Date) {
      return exifDate.DateTimeOriginal.toISOString();
    }
  } catch (error) {
    logWarn(`EXIF parse failed for ${filePath}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return stats.mtime.toISOString();
}

async function getImageDimensions(filePath: string) {
  try {
    const metadata = await sharp(filePath, { failOn: "none" }).metadata();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch (error) {
    logWarn(`Dimension read failed for ${filePath}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      width: null,
      height: null,
    };
  }
}

export async function runScan(mode: ScanMode = "incremental") {
  const scanRunId = newScanRunId();
  if (!startScanLock(scanRunId)) {
    throw new Error("A scan is already running.");
  }

  const startedAt = nowIso();
  const scanRunRecord: ScanRunRecord = {
    id: scanRunId,
    mode,
    started_at: startedAt,
    finished_at: null,
    status: "running",
    scanned: 0,
    inserted: 0,
    updated: 0,
    missing: 0,
    errors: 0,
    error_message: null,
  };
  createScanRun(scanRunRecord);

  const summary: ScanSummary = {
    scanned: 0,
    inserted: 0,
    updated: 0,
    missing: 0,
    errors: 0,
  };

  try {
    await logPhotoRootStatus(config.photoLibraryRoot, "scan start");

    const rootReachable = await checkPhotoRootReachable(config.photoLibraryRoot);
    if (!rootReachable) {
      throw new Error("PHOTO_LIBRARY_ROOT is not reachable or readable.");
    }

    logInfo("Photo scan started.", {
      mode,
      photoLibraryRoot: config.photoLibraryRoot,
      supportedExtensions,
    });

    if (mode === "full") {
      logInfo(
        "Full scan mode currently reuses incremental scan behavior and is reserved for deeper cleanup later."
      );
    }

    const patterns = supportedExtensions.map((extension) => `**/*.${extension}`);
    const matches = await fg(patterns, {
      cwd: config.photoLibraryRoot,
      absolute: true,
      caseSensitiveMatch: false,
      onlyFiles: true,
      suppressErrors: true,
    });

    const seenIds = new Set<string>();

    for (const absolutePath of matches) {
      summary.scanned += 1;

      try {
        const stats = await fs.promises.stat(absolutePath);
        const modifiedAt = stats.mtime.toISOString();
        const existingByPath = getPhotoByPath(absolutePath);
        const timestamp = nowIso();

        if (
          existingByPath &&
          existingByPath.file_size === stats.size &&
          existingByPath.last_modified_at === modifiedAt
        ) {
          seenIds.add(existingByPath.id);
          touchPhotoSeen({
            id: existingByPath.id,
            last_seen_at: timestamp,
            updated_at: timestamp,
            last_modified_at: modifiedAt,
            file_size: stats.size,
          });
        } else {
          const contentHash = await sha256ForFile(absolutePath);
          const existing = getPhotoByHash(contentHash);
          const { width, height } = await getImageDimensions(absolutePath);
          const takenAt = await getTakenAt(absolutePath, stats);
          const id = existing?.id ?? contentHash;

          seenIds.add(id);

          const record: PhotoAssetRecord = {
            id,
            content_hash: contentHash,
            current_path: absolutePath,
            filename: path.basename(absolutePath),
            taken_at: takenAt,
            last_modified_at: modifiedAt,
            file_size: stats.size,
            width,
            height,
            mime_type: mime.lookup(absolutePath) || null,
            thumbnail_path: existing?.thumbnail_path ?? null,
            is_missing: 0,
            first_seen_at: existing?.first_seen_at ?? timestamp,
            last_seen_at: timestamp,
            updated_at: timestamp,
          };

          upsertPhoto(record);

          if (existing || existingByPath) {
            summary.updated += 1;
          } else {
            summary.inserted += 1;
          }
        }
      } catch (error) {
        summary.errors += 1;
        logWarn(`Failed to index ${absolutePath}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (summary.scanned % PROGRESS_FLUSH_INTERVAL === 0) {
        updateScanRunProgress(scanRunId, summary);
        logInfo("Photo scan progress checkpoint.", summary);
      }
    }

    const allKnownIds = getAllPhotoIds();
    const timestamp = nowIso();
    for (const knownId of allKnownIds) {
      if (!seenIds.has(knownId)) {
        markPhotoMissing(knownId, timestamp);
        summary.missing += 1;
      }
    }

    updateScanRunProgress(scanRunId, summary);
    finishScanRun(scanRunId, summary, "success", null);
    logInfo("Photo scan finished.", {
      scanRunId,
      mode,
      ...summary,
    });
    return {
      scanRunId,
      mode,
      summary,
    };
  } catch (error) {
    finishScanRun(
      scanRunId,
      summary,
      "failed",
      error instanceof Error ? error.message : String(error)
    );
    logError("Photo scan failed.", {
      summary,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    endScanLock();
  }
}

export function getScanRunningState() {
  return isScanRunning();
}
