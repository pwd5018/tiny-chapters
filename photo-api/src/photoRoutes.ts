import fs from "node:fs";
import path from "node:path";

import express from "express";

import { requireApiKey } from "./auth";
import { config } from "./config";
import {
  getAllActivePhotos,
  getPhotosInFolder,
  getPhotoById,
  getPhotosByDate as getPhotosByDateFromDb,
  searchPhotos as searchPhotosInDb,
} from "./db";
import { getScanRunningState, runScan } from "./indexer";
import { getStatusPayload } from "./statusService";
import { ensureThumbnail } from "./thumbnail";
import type {
  ApiPhotoAsset,
  FolderResponse,
  PhotoAssetRecord,
  PhotoMatchCandidate,
  PhotoSearchParams,
  ScanMode,
} from "./types";

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

function parseOptionalNumber(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePagingNumber(value: unknown, fallback: number, minimum: number) {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed !== "number") {
    return fallback;
  }

  return Math.max(minimum, Math.floor(parsed));
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getRootPath() {
  return path.resolve(config.photoLibraryRoot);
}

function normalizeRelativeFolderPath(rawPath: unknown) {
  const trimmed = typeof rawPath === "string" ? rawPath.trim() : "";

  if (!trimmed) {
    return "";
  }

  if (path.isAbsolute(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    return null;
  }

  const normalized = path.normalize(trimmed.replace(/[\\/]+/g, path.sep));

  if (
    normalized === "." ||
    normalized.includes(`..${path.sep}`) ||
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    return null;
  }

  return normalized.split(path.sep).join("/");
}

function resolveSafeFolderPath(rawPath: unknown) {
  const relativePath = normalizeRelativeFolderPath(rawPath);

  if (relativePath === null) {
    return null;
  }

  const rootPath = getRootPath();
  const resolvedPath = path.resolve(rootPath, relativePath);
  const relativeCheck = path.relative(rootPath, resolvedPath);

  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
    return null;
  }

  const normalizedPath = relativeCheck === "" ? "" : relativeCheck.split(path.sep).join("/");
  const parentPath =
    normalizedPath && normalizedPath.includes("/")
      ? normalizedPath.split("/").slice(0, -1).join("/")
      : null;

  return {
    resolvedPath,
    path: normalizedPath,
    parentPath,
  };
}

function listChildFolders(folderPath: string): FolderResponse["folders"] {
  const safeFolder = resolveSafeFolderPath(folderPath);

  if (!safeFolder || !fs.existsSync(safeFolder.resolvedPath)) {
    return [];
  }

  return fs
    .readdirSync(safeFolder.resolvedPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: safeFolder.path ? `${safeFolder.path}/${entry.name}` : entry.name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeFilename(filename: string) {
  return filename.trim().toLowerCase();
}

function scoreCandidate(candidate: PhotoMatchCandidate, photo: PhotoAssetRecord) {
  let score = 0;
  let filenameExact = false;
  let exactDimensions = false;
  let rotatedDimensions = false;
  let exactFileSize = false;

  if (candidate.filename) {
    if (normalizeFilename(candidate.filename) === normalizeFilename(photo.filename)) {
      score += 40;
      filenameExact = true;
    }
  }

  if (candidate.takenAt) {
    const candidateMs = Date.parse(candidate.takenAt);
    const photoMs = Date.parse(photo.taken_at);

    if (!Number.isNaN(candidateMs) && !Number.isNaN(photoMs)) {
      const toleranceMinutes = candidate.toleranceMinutes ?? 10;
      const diffMinutes = Math.abs(candidateMs - photoMs) / 60000;

      if (diffMinutes <= toleranceMinutes) {
        score += diffMinutes <= 2 ? 48 : 34;
      }
    }
  }

  if (typeof candidate.fileSize === "number" && typeof photo.file_size === "number") {
    const diff = Math.abs(candidate.fileSize - photo.file_size);
    if (diff === 0) {
      score += 28;
      exactFileSize = true;
    } else if (diff <= 1024) {
      score += 20;
    } else if (diff <= 20_480) {
      score += 12;
    }
  }

  if (typeof candidate.width === "number" && typeof candidate.height === "number") {
    if (photo.width === candidate.width && photo.height === candidate.height) {
      score += 18;
      exactDimensions = true;
    } else if (photo.width === candidate.height && photo.height === candidate.width) {
      score += 18;
      rotatedDimensions = true;
    } else if (photo.width === candidate.width || photo.height === candidate.height) {
      score += 5;
    }
  }

  if (filenameExact && exactDimensions) {
    score += 10;
  }

  if (rotatedDimensions) {
    score += 4;
  }

  if (exactFileSize && (exactDimensions || rotatedDimensions)) {
    score += 20;
  }

  return score;
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

  router.get("/photos/:photoId", (req, res, next) => {
    if (req.params.photoId === "search" || req.params.photoId === "match") {
      next();
      return;
    }

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

  router.get("/photos/search", (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    if (date && !isValidDateKey(date)) {
      res.status(400).json({ error: "date query must be YYYY-MM-DD" });
      return;
    }

    if (from && !isValidDateKey(from)) {
      res.status(400).json({ error: "from query must be YYYY-MM-DD" });
      return;
    }

    if (to && !isValidDateKey(to)) {
      res.status(400).json({ error: "to query must be YYYY-MM-DD" });
      return;
    }

    const params: PhotoSearchParams = {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      date,
      from,
      to,
      limit: parsePagingNumber(req.query.limit, 50, 1),
      offset: parsePagingNumber(req.query.offset, 0, 0),
    };

    const result = searchPhotosInDb(params);

    res.json({
      items: result.items.map((record) => toApiPhotoAsset(record, req)),
      limit: result.limit,
      offset: result.offset,
      total: result.total,
      hasMore: result.hasMore,
    });
  });

  router.get("/folders", (req, res) => {
    const safeFolder = resolveSafeFolderPath(req.query.path);

    if (!safeFolder) {
      res.status(400).json({ error: "path must stay inside PHOTO_LIBRARY_ROOT" });
      return;
    }

    if (!fs.existsSync(safeFolder.resolvedPath) || !fs.statSync(safeFolder.resolvedPath).isDirectory()) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    res.json({
      path: safeFolder.path,
      parentPath: safeFolder.parentPath,
      folders: listChildFolders(safeFolder.path),
    });
  });

  router.get("/folder-photos", (req, res) => {
    const safeFolder = resolveSafeFolderPath(req.query.path);

    if (!safeFolder) {
      res.status(400).json({ error: "path must stay inside PHOTO_LIBRARY_ROOT" });
      return;
    }

    if (!safeFolder.path) {
      res.status(400).json({ error: "path query is required" });
      return;
    }

    if (!fs.existsSync(safeFolder.resolvedPath) || !fs.statSync(safeFolder.resolvedPath).isDirectory()) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const limit = parsePagingNumber(req.query.limit, 50, 1);
    const offset = parsePagingNumber(req.query.offset, 0, 0);
    const result = getPhotosInFolder(safeFolder.resolvedPath, limit, offset);

    res.json({
      path: safeFolder.path,
      items: result.items.map((record) => toApiPhotoAsset(record, req)),
      limit: result.limit,
      offset: result.offset,
      total: result.total,
      hasMore: result.hasMore,
    });
  });

  router.get("/photos/match", (req, res) => {
    const candidate: PhotoMatchCandidate = {
      filename:
        typeof req.query.filename === "string" && req.query.filename.trim()
          ? req.query.filename
          : undefined,
      takenAt:
        typeof req.query.takenAt === "string" && req.query.takenAt.trim()
          ? req.query.takenAt
          : undefined,
      fileSize: parseOptionalNumber(req.query.fileSize),
      width: parseOptionalNumber(req.query.width),
      height: parseOptionalNumber(req.query.height),
      toleranceMinutes: parseOptionalNumber(req.query.toleranceMinutes),
    };

    if (
      !candidate.filename &&
      !candidate.takenAt &&
      typeof candidate.fileSize !== "number" &&
      typeof candidate.width !== "number" &&
      typeof candidate.height !== "number"
    ) {
      res.status(400).json({
        error: "At least one match query field is required.",
      });
      return;
    }

    const scoredCandidates = getAllActivePhotos()
      .map((photo) => ({
        score: scoreCandidate(candidate, photo),
        photo,
      }))
      .filter((entry) => entry.score >= 60)
      .sort((left, right) => right.score - left.score);

    if (!scoredCandidates.length) {
      res.status(404).json({ matched: false });
      return;
    }

    const [topCandidate, secondCandidate] = scoredCandidates;
    const topConfidence = Math.min(100, topCandidate.score);
    const secondConfidence = secondCandidate ? Math.min(100, secondCandidate.score) : 0;

    if (secondCandidate && topConfidence < 90 && topConfidence - secondConfidence < 15) {
      res.status(409).json({
        matched: false,
        candidates: scoredCandidates.slice(0, 3).map((entry) => ({
          confidence: Math.min(100, entry.score),
          photo: toApiPhotoAsset(entry.photo, req),
        })),
      });
      return;
    }

    if (topConfidence < 70) {
      res.status(404).json({ matched: false });
      return;
    }

    res.json({
      matched: true,
      confidence: topConfidence,
      photo: toApiPhotoAsset(topCandidate.photo, req),
    });
  });

  return router;
}
