import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import cors from "cors";
import express from "express";

import { createAiRouter } from "./aiRoutes";
import { config } from "./config";
import { closeDatabase, markInterruptedScanRuns, markScanRunInterrupted } from "./db";
import { logError, logInfo } from "./logger";
import { createPhotoRouter } from "./photoRoutes";
import { logPhotoRootStatus } from "./fsChecks";
import { getActiveScanRunId } from "./runtime";
import { startScheduledScanRunner } from "./scheduler";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
) as { version: string };

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.thumbnailCacheDir, { recursive: true });
markInterruptedScanRuns();

void logPhotoRootStatus(config.photoLibraryRoot, "server startup");

const app = express();

app.use(cors());
app.use(express.json());
app.use(createPhotoRouter(packageJson.version));
app.use(createAiRouter());

const schedulerHandle = startScheduledScanRunner();

const server = app.listen(config.port, () => {
  logInfo("tinychapters-photo-api listening.", {
    version: packageJson.version,
    port: config.port,
    photoLibraryRoot: config.photoLibraryRoot,
    thumbnailCacheDir: config.thumbnailCacheDir,
    databasePath: config.databasePath,
    aiProvider: config.aiProvider,
    schedulerEnabled: config.enableScheduledScan,
    scheduledScanTime: config.scheduledScanTime,
    scheduledScanTimezone: config.scheduledScanTimezone,
  });
});

let shutdownStarted = false;

function shutdown(signal: string) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logInfo("tinychapters-photo-api shutting down.", { signal });
  schedulerHandle?.stop();

  const activeScanRunId = getActiveScanRunId();
  if (activeScanRunId) {
    markScanRunInterrupted(activeScanRunId, `Scan interrupted by ${signal}.`);
  }

  server.close((error) => {
    if (error) {
      logError("Server close failed during shutdown.", {
        signal,
        error: error.message,
      });
    }

    closeDatabase();
    process.exit(error ? 1 : 0);
  });

  setTimeout(() => {
    logError("Forced shutdown after timeout.", { signal });
    try {
      closeDatabase();
    } catch {
      // Ignore double-close issues on forced exit.
    }
    process.exit(1);
  }, 5000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
