import { config } from "./config";
import { getLatestScanRun, getPhotoCounts } from "./db";
import { checkPhotoRootReachable } from "./fsChecks";
import {
  getActiveScanRunId,
  getNextScheduledScanAt,
  getServerStartedAt,
  getUptimeSeconds,
  isScanRunning,
} from "./runtime";
import type { ScanSummary, StatusPayload } from "./types";

function toScanSummary(lastScan: ReturnType<typeof getLatestScanRun>): ScanSummary | null {
  if (!lastScan) {
    return null;
  }

  return {
    scanned: lastScan.scanned,
    inserted: lastScan.inserted,
    updated: lastScan.updated,
    missing: lastScan.missing,
    errors: lastScan.errors,
  };
}

export async function getStatusPayload(): Promise<StatusPayload> {
  const counts = getPhotoCounts();
  const lastScan = getLatestScanRun();
  const rootReachable = await checkPhotoRootReachable(config.photoLibraryRoot);

  return {
    status: "ok",
    serverStartedAt: getServerStartedAt(),
    uptimeSeconds: getUptimeSeconds(),
    schedulerEnabled: config.enableScheduledScan,
    scheduledScanTime: config.scheduledScanTime,
    scheduledScanTimezone: config.scheduledScanTimezone,
    nextScheduledScanAt: getNextScheduledScanAt(),
    activeScanRunId: getActiveScanRunId(),
    scanInProgress: isScanRunning(),
    indexedPhotoCount: counts.indexedCount,
    missingPhotoCount: counts.missingCount,
    lastScanStartedAt: lastScan?.started_at ?? null,
    lastScanFinishedAt: lastScan?.finished_at ?? null,
    lastScanStatus: lastScan?.status ?? null,
    lastScanSummary: toScanSummary(lastScan),
    photoLibraryRoot: config.photoLibraryRoot,
    thumbnailCacheDir: config.thumbnailCacheDir,
    databasePath: config.databasePath,
    rootReachable,
  };
}
