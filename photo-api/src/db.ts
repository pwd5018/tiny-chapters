import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { config } from "./config";
import type {
  PhotoAssetRecord,
  PhotoSearchParams,
  ScanRunRecord,
  ScanSummary,
} from "./types";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const schemaSql = fs.readFileSync(path.resolve(process.cwd(), "src/db/schema.sql"), "utf8");

export const db = new DatabaseSync(config.databasePath);
db.exec("pragma journal_mode = WAL;");
db.exec(schemaSql);
try {
  db.exec("alter table photo_assets add column last_modified_at text;");
} catch {
  // Column already exists in upgraded databases.
}
try {
  db.exec("alter table scan_runs add column mode text not null default 'incremental';");
} catch {
  // Column already exists in upgraded databases.
}

const selectByIdStatement = db.prepare(
  "select * from photo_assets where id = ? and is_missing = 0"
);
const selectByPathStatement = db.prepare(
  "select * from photo_assets where current_path = ? and is_missing = 0"
);
const selectAllActivePhotosStatement = db.prepare(
  "select * from photo_assets where is_missing = 0 order by taken_at desc"
);
const selectByDateStatement = db.prepare(
  "select * from photo_assets where is_missing = 0 and substr(taken_at, 1, 10) = ? order by taken_at asc"
);
const selectAllIdsStatement = db.prepare("select id from photo_assets");
const selectByHashStatement = db.prepare("select * from photo_assets where content_hash = ?");
const selectCountsStatement = db.prepare(`
  select
    sum(case when is_missing = 0 then 1 else 0 end) as indexed_count,
    sum(case when is_missing = 1 then 1 else 0 end) as missing_count
  from photo_assets
`);
const selectLatestScanRunStatement = db.prepare(
  "select * from scan_runs order by started_at desc limit 1"
);
const selectScanRunByIdStatement = db.prepare("select * from scan_runs where id = ?");
const insertScanRunStatement = db.prepare(`
  insert into scan_runs (
    id, mode, started_at, finished_at, status, scanned, inserted, updated, missing, errors, error_message
  ) values (
    @id, @mode, @started_at, @finished_at, @status, @scanned, @inserted, @updated, @missing, @errors, @error_message
  )
`);
const updateScanRunStatement = db.prepare(`
  update scan_runs
  set
    finished_at = @finished_at,
    status = @status,
    scanned = @scanned,
    inserted = @inserted,
    updated = @updated,
    missing = @missing,
    errors = @errors,
    error_message = @error_message
  where id = @id
`);
const failRunningScanRunsStatement = db.prepare(`
  update scan_runs
  set
    finished_at = ?,
    status = 'failed',
    error_message = coalesce(error_message, 'Scan interrupted before completion.')
  where status = 'running'
`);
const upsertPhotoStatement = db.prepare(`
  insert into photo_assets (
    id, content_hash, current_path, filename, taken_at, last_modified_at, file_size, width, height,
    mime_type, thumbnail_path, is_missing, first_seen_at, last_seen_at, updated_at
  ) values (
    @id, @content_hash, @current_path, @filename, @taken_at, @last_modified_at, @file_size, @width, @height,
    @mime_type, @thumbnail_path, @is_missing, @first_seen_at, @last_seen_at, @updated_at
  )
  on conflict(id) do update set
    content_hash = excluded.content_hash,
    current_path = excluded.current_path,
    filename = excluded.filename,
    taken_at = excluded.taken_at,
    last_modified_at = excluded.last_modified_at,
    file_size = excluded.file_size,
    width = excluded.width,
    height = excluded.height,
    mime_type = excluded.mime_type,
    thumbnail_path = excluded.thumbnail_path,
    is_missing = excluded.is_missing,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at
`);
const markMissingStatement = db.prepare(
  "update photo_assets set is_missing = 1, updated_at = ? where id = ?"
);
const touchPhotoSeenStatement = db.prepare(`
  update photo_assets
  set
    is_missing = 0,
    last_seen_at = @last_seen_at,
    updated_at = @updated_at,
    last_modified_at = @last_modified_at,
    file_size = @file_size
  where id = @id
`);

export function getPhotoById(photoId: string) {
  return (selectByIdStatement.get(photoId) as PhotoAssetRecord | undefined) ?? null;
}

export function getPhotosByDate(date: string) {
  return selectByDateStatement.all(date) as PhotoAssetRecord[];
}

export function getAllActivePhotos() {
  return selectAllActivePhotosStatement.all() as PhotoAssetRecord[];
}

export function getPhotoByPath(currentPath: string) {
  return (selectByPathStatement.get(currentPath) as PhotoAssetRecord | undefined) ?? null;
}

export function getAllPhotoIds() {
  return (selectAllIdsStatement.all() as Array<{ id: string }>).map((row) => row.id);
}

export function getPhotoByHash(contentHash: string) {
  return (selectByHashStatement.get(contentHash) as PhotoAssetRecord | undefined) ?? null;
}

function toLocalDateString(isoString: string) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paginateRecords(records: PhotoAssetRecord[], limit: number, offset: number) {
  return {
    items: records.slice(offset, offset + limit),
    limit,
    offset,
    total: records.length,
    hasMore: offset + limit < records.length,
  };
}

export function searchPhotos(params: PhotoSearchParams) {
  const normalizedQuery = params.q?.trim().toLowerCase() ?? "";
  const filtered = getAllActivePhotos()
    .filter((record) => {
      const localDate = toLocalDateString(record.taken_at);

      if (params.date && localDate !== params.date) {
        return false;
      }

      if (params.from && localDate < params.from) {
        return false;
      }

      if (params.to && localDate > params.to) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        record.filename.toLowerCase().includes(normalizedQuery) ||
        record.current_path.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((left, right) => right.taken_at.localeCompare(left.taken_at));

  return paginateRecords(filtered, params.limit, params.offset);
}

export function getPhotosInFolder(folderPath: string, limit: number, offset: number) {
  const normalizedFolderPath = folderPath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const folderPrefix = normalizedFolderPath ? `${normalizedFolderPath}/` : "";
  const filtered = getAllActivePhotos()
    .filter((record) => {
      const normalizedPath = record.current_path.replace(/\\/g, "/").toLowerCase();

      if (!normalizedFolderPath) {
        return true;
      }

      return normalizedPath.startsWith(folderPrefix);
    })
    .sort((left, right) => right.taken_at.localeCompare(left.taken_at));

  return paginateRecords(filtered, limit, offset);
}

export function getPhotoCounts() {
  const counts = selectCountsStatement.get() as
    | { indexed_count: number | null; missing_count: number | null }
    | undefined;

  return {
    indexedCount: counts?.indexed_count ?? 0,
    missingCount: counts?.missing_count ?? 0,
  };
}

export function getLatestScanRun() {
  return (selectLatestScanRunStatement.get() as ScanRunRecord | undefined) ?? null;
}

export function getScanRunById(id: string) {
  return (selectScanRunByIdStatement.get(id) as ScanRunRecord | undefined) ?? null;
}

export function createScanRun(scanRun: ScanRunRecord) {
  insertScanRunStatement.run(scanRun);
}

export function finishScanRun(
  id: string,
  summary: ScanSummary,
  status: ScanRunRecord["status"],
  errorMessage: string | null
) {
  updateScanRunStatement.run({
    id,
    finished_at: new Date().toISOString(),
    status,
    scanned: summary.scanned,
    inserted: summary.inserted,
    updated: summary.updated,
    missing: summary.missing,
    errors: summary.errors,
    error_message: errorMessage,
  });
}

export function updateScanRunProgress(id: string, summary: ScanSummary) {
  updateScanRunStatement.run({
    id,
    finished_at: null,
    status: "running",
    scanned: summary.scanned,
    inserted: summary.inserted,
    updated: summary.updated,
    missing: summary.missing,
    errors: summary.errors,
    error_message: null,
  });
}

export function markInterruptedScanRuns() {
  failRunningScanRunsStatement.run(new Date().toISOString());
}

export function markScanRunInterrupted(id: string, errorMessage: string) {
  const existing = getScanRunById(id);
  if (!existing || existing.status !== "running") {
    return;
  }

  finishScanRun(
    id,
    {
      scanned: existing.scanned,
      inserted: existing.inserted,
      updated: existing.updated,
      missing: existing.missing,
      errors: existing.errors,
    },
    "failed",
    errorMessage
  );
}

export function closeDatabase() {
  db.close();
}

export function upsertPhoto(record: PhotoAssetRecord) {
  upsertPhotoStatement.run(record);
}

export function markPhotoMissing(photoId: string, timestamp: string) {
  markMissingStatement.run(timestamp, photoId);
}

export function touchPhotoSeen(input: {
  id: string;
  last_seen_at: string;
  updated_at: string;
  last_modified_at: string | null;
  file_size: number | null;
}) {
  touchPhotoSeenStatement.run(input);
}
