import fs from "node:fs";

import express from "express";

import { requireApiKey } from "./auth";
import { getPhotosByDate as getPhotosByDateFromDb, getPhotoById } from "./db";
import { getScanRunningState, runScan } from "./indexer";
import { getStatusPayload } from "./statusService";
import { ensureThumbnail } from "./thumbnail";
import type { ApiPhotoAsset, PhotoAssetRecord, ScanMode } from "./types";

function getBaseUrl(req: express.Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function toLocalDateString(isoString: string) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiPhotoAsset(record: PhotoAssetRecord, req: express.Request): ApiPhotoAsset {
  const baseUrl = getBaseUrl(req);

  return {
    id: record.id,
    source: "nas",
    takenAt: record.taken_at,
    filename: record.filename,
    path: record.current_path,
    thumbnailUrl: `${baseUrl}/photos/${record.id}/thumb`,
    viewUrl: `${baseUrl}/photos/${record.id}/view`,
    contentHash: record.content_hash,
    fileSize: record.file_size ?? undefined,
    width: record.width ?? undefined,
    height: record.height ?? undefined,
  };
}

export function createPhotoRouter(version: string) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "tinychapters-photo-api",
      version,
    });
  });

  router.use(requireApiKey);

  router.get("/status", async (_req, res) => {
    const payload = await getStatusPayload();
    res.json(payload);
  });

  router.post("/index/scan", async (req, res) => {
    if (getScanRunningState()) {
      res.status(409).json({ error: "A scan is already running." });
      return;
    }

    const requestedMode = req.body?.mode;
    const mode: ScanMode =
      requestedMode === "full" || requestedMode === "incremental"
        ? requestedMode
        : "incremental";

    try {
      const result = await runScan(mode);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Photo scan failed.",
      });
    }
  });

  router.post("/index/cancel", (_req, res) => {
    if (!getScanRunningState()) {
      res.json({ message: "No scan currently running" });
      return;
    }

    res.status(501).json({
      message: "Scan cancellation is not implemented yet",
    });
  });

  router.get("/photos", (req, res) => {
    const date = String(req.query.date ?? "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date query must be YYYY-MM-DD" });
      return;
    }

    const rows = getPhotosByDateFromDb(date).filter(
      (record) => toLocalDateString(record.taken_at) === date
    );

    res.json(rows.map((record) => toApiPhotoAsset(record, req)));
  });

  router.get("/photos/:photoId", (req, res) => {
    const record = getPhotoById(req.params.photoId);

    if (!record) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }

    res.json(toApiPhotoAsset(record, req));
  });

  router.get("/photos/:photoId/thumb", async (req, res) => {
    const record = getPhotoById(req.params.photoId);

    if (!record || !fs.existsSync(record.current_path)) {
      res.status(404).json({ error: "Thumbnail source not found" });
      return;
    }

    try {
      const thumbnailPath = await ensureThumbnail(record.id, record.current_path);
      res.sendFile(thumbnailPath);
    } catch (error) {
      res.status(404).json({ error: "Thumbnail unavailable" });
    }
  });

  router.get("/photos/:photoId/view", (req, res) => {
    const record = getPhotoById(req.params.photoId);

    if (!record || !fs.existsSync(record.current_path)) {
      res.status(404).json({ error: "Photo source not found" });
      return;
    }

    if (record.mime_type) {
      res.type(record.mime_type);
    }

    res.sendFile(record.current_path);
  });

  return router;
}
