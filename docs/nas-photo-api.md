# NAS Photo API

## Purpose

Tiny Chapters stores memories in Supabase, but photos remain outside the database. The NAS Photo API is the future metadata layer that lets the mobile app discover and reference photos without uploading or copying originals.

## API endpoints

All routes except `/health` require:

```text
Authorization: Bearer <PHOTO_API_KEY>
```

### `GET /health`

No auth required.

Returns:

```json
{
  "status": "ok",
  "service": "tinychapters-photo-api",
  "version": "1.0.0"
}
```

### `GET /status`

Requires auth.

Returns:

```json
{
  "status": "ok",
  "serverStartedAt": "2026-06-21T09:30:00.000Z",
  "uptimeSeconds": 600,
  "schedulerEnabled": true,
  "scheduledScanTime": "02:00",
  "scheduledScanTimezone": "America/New_York",
  "nextScheduledScanAt": "2026-06-22T06:00:00.000Z",
  "activeScanRunId": null,
  "scanInProgress": false,
  "indexedPhotoCount": 1234,
  "missingPhotoCount": 12,
  "lastScanStartedAt": "2026-06-20T01:00:00.000Z",
  "lastScanFinishedAt": "2026-06-20T01:11:00.000Z",
  "lastScanStatus": "success",
  "lastScanSummary": {
    "scanned": 500,
    "inserted": 5,
    "updated": 480,
    "missing": 2,
    "errors": 13
  },
  "photoLibraryRoot": "\\\\NAS_NAME\\Photos",
  "thumbnailCacheDir": "./cache/thumbnails",
  "databasePath": "./data/photo-index.sqlite",
  "rootReachable": true
}
```

### `POST /index/scan`

Requires auth.

Accepts optional body:

```json
{
  "mode": "incremental"
}
```

Response:

```json
{
  "scanRunId": "uuid-like-id",
  "mode": "incremental",
  "summary": {
    "scanned": 500,
    "inserted": 5,
    "updated": 480,
    "missing": 2,
    "errors": 13
  }
}
```

Notes:
- `incremental` is the normal mode
- `full` currently behaves the same as `incremental`
- the separate mode is there so deeper cleanup can be added later without changing clients

### `POST /index/cancel`

Requires auth.

Current placeholder behavior:
- if no scan is running: `200 { "message": "No scan currently running" }`
- if a scan is running: `501 { "message": "Scan cancellation is not implemented yet" }`

### `GET /photos?date=YYYY-MM-DD`

Returns all indexed photos for a given day.

Example response:

```json
[
  {
    "id": "sha256-or-stable-id",
    "source": "nas",
    "takenAt": "2026-06-17T14:22:00.000Z",
    "filename": "IMG_4432.jpg",
    "path": "/volume1/photos/2026/06/IMG_4432.jpg",
    "thumbnailUrl": "http://192.168.1.50:5055/photos/sha/thumb",
    "viewUrl": "http://192.168.1.50:5055/photos/sha/view",
    "contentHash": "sha256...",
    "fileSize": 3442231,
    "width": 4032,
    "height": 3024
  }
]
```

### `GET /photos/search`

Requires auth.

Query params:

- `q` optional string, matched against filename and path
- `date` optional `YYYY-MM-DD`
- `from` optional `YYYY-MM-DD`
- `to` optional `YYYY-MM-DD`
- `limit` optional number, default `50`
- `offset` optional number, default `0`

Returns paged results:

```json
{
  "items": [],
  "limit": 50,
  "offset": 0,
  "total": 0,
  "hasMore": false
}
```

### `GET /folders?path=`

Requires auth.

Returns child folders for a safe relative path under `PHOTO_LIBRARY_ROOT`.

Example response:

```json
{
  "path": "2026/06",
  "parentPath": "2026",
  "folders": [
    {
      "name": "12",
      "path": "2026/06/12"
    }
  ]
}
```

### `GET /folder-photos?path=&limit=&offset=`

Requires auth.

Returns paged indexed photos for the selected relative folder path.

Example response:

```json
{
  "path": "2026/06/12",
  "items": [],
  "limit": 50,
  "offset": 0,
  "total": 0,
  "hasMore": false
}
```

### `GET /photos/:photoId`

Returns one indexed photo record or `404` if missing.

### `GET /photos/match`

Requires auth.

Query params:

- `filename` optional
- `takenAt` optional ISO string
- `fileSize` optional number
- `width` optional number
- `height` optional number
- `toleranceMinutes` optional number, default `10`

Behavior:

- tries a conservative metadata match against indexed NAS photos
- false positives are treated as worse than misses
- returns `404` when no confident match is found
- returns `409` when multiple candidates are too close to call safely

Matched response:

```json
{
  "matched": true,
  "confidence": 87,
  "photo": {
    "id": "sha256-or-stable-id",
    "source": "nas",
    "takenAt": "2026-06-17T14:22:00.000Z",
    "filename": "IMG_4432.jpg",
    "path": "/volume1/photos/2026/06/IMG_4432.jpg",
    "thumbnailUrl": "http://192.168.1.50:5055/photos/sha/thumb",
    "viewUrl": "http://192.168.1.50:5055/photos/sha/view",
    "contentHash": "sha256...",
    "fileSize": 3442231,
    "width": 4032,
    "height": 3024
  }
}
```

## Stable photo ID strategy

The preferred long-term strategy is to use a stable ID derived from the photo content hash, typically SHA-256.

Why:
- file paths can change when folders are reorganized
- duplicate filenames are common
- content hashes help preserve identity across moves or renames

Recommended shape:
- `id`: stable photo identifier used by the mobile app
- `contentHash`: raw SHA-256 or similar digest for verification and deduping

## Why the app stores references instead of copies

Tiny Chapters should not duplicate the NAS photo library into Supabase or local app storage. Memories store lightweight references such as:

- `photoId`
- `source`
- `path`
- `contentHash`
- `syncStatus`

This keeps:
- the NAS as source of truth
- Supabase focused on memory data
- future export flows simpler

The mobile app now uses:

- `thumbnailUrl` for grid cards and lightweight picker browsing
- `viewUrl` for simple full-image preview modals

Those are served directly by the Photo API. No thumbnails are copied into Supabase.

The mobile app now uses a native date picker for NAS day lookups instead of free-form date text entry. It still sends `YYYY-MM-DD` internally to the service layer and Photo API.

## Captured photo durability model

Tiny Chapters now supports temporary local phone photo refs in addition to durable NAS refs.

Intended lifecycle:

1. User captures or attaches a phone photo in the app
2. Tiny Chapters stores metadata only, not the full photo binary
3. The memory saves `source: "local"` with `syncStatus: "pending_nas_match"`
4. The phone later backs that photo up to the NAS outside the app
5. A future relink phase matches the temporary local ref to a durable NAS photo ID

Tiny Chapters now also attempts that match immediately after attach or capture. If the photo is already backed up and indexed, the memory can store the durable NAS ref on the first save.

Important:
- `local_uri` is device-specific and not durable across devices
- full photos are not uploaded to Supabase
- thumbnails are not uploaded to Supabase
- the NAS remains the long-term archive
- matching stays conservative to avoid linking the wrong photo

## Broken link handling

If a photo later becomes unavailable:
- memory rows should remain intact
- the app should show the memory without crashing
- thumbnail previews should fail gracefully
- missing files should be marked in the index rather than hard-deleted immediately

## Future indexer concept

The future backend should:

- scan configured NAS folders
- read EXIF `DateTimeOriginal` where available
- fall back to file modified or created timestamps when EXIF is missing
- compute SHA-256 content hashes
- generate thumbnails and view URLs
- maintain an index database for lookup speed
- preserve photo IDs across file moves
- mark missing files instead of deleting immediately

## Local service deployment shape

For Tiny Chapters, the first production-like version of this API does not need Docker and does not need to run on the NAS itself. A practical path is:

- Windows PC
- mini PC on the same LAN
- access to the NAS shared folder through UNC path or mapped drive

Example env:

```text
PORT=5055
PHOTO_LIBRARY_ROOT=\\\\NAS_NAME\\Photos
PHOTO_API_KEY=change-me
ENABLE_SCHEDULED_SCAN=false
SCHEDULED_SCAN_TIME=02:00
SCHEDULED_SCAN_TIMEZONE=America/New_York
THUMBNAIL_CACHE_DIR=./cache/thumbnails
DATABASE_PATH=./data/photo-index.sqlite
```

The mobile app should then use:

```text
EXPO_PUBLIC_PHOTO_SOURCE_MODE=nas
EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055
EXPO_PUBLIC_NAS_PHOTO_API_KEY=change-me
```

On Android physical devices:
- `localhost` points to the phone itself
- use the LAN IP of the PC or mini PC hosting the API
- Windows Firewall may need port `5055` opened

## Operational hardening notes

- scan runs are persisted in SQLite
- overlapping scans are blocked
- `/status` reports index counts, runtime info, and last scan info
- startup and scan time root checks help explain NAS access failures
- secrets such as `PHOTO_API_KEY` should never be logged
- interrupted scans are marked failed on the next startup or CLI run
- unchanged files can be skipped on future scans using path + size + modified time
- built-in scheduled scans can run daily inside the server process

## Windows scheduled task recommendation

Recommended operational pattern:

- Option A for development: run `npm run dev`
- Option B for always-on use: run `npm run build`, then `npm run start`, then create a startup task on login
- optionally keep a nightly `npm run scan` task if you do not want the built-in scheduler enabled

Prefer UNC paths over mapped drive letters because scheduled tasks often do not inherit mapped drive availability.

Also note:
- `Run whether user is logged on or not` may fail to reach the NAS share
- `Run only when user is logged on` is usually the safest first setup

## Recommended local verification order

1. `cd photo-api`
2. `npm run build`
3. `npm run start`
4. `curl http://localhost:5055/health`
5. `curl -H "Authorization: Bearer <PHOTO_API_KEY>" http://localhost:5055/status`
6. `curl -X POST -H "Authorization: Bearer <PHOTO_API_KEY>" -H "Content-Type: application/json" -d "{\"mode\":\"incremental\"}" http://localhost:5055/index/scan`
7. confirm `/status` shows updated scan fields
8. set `ENABLE_SCHEDULED_SCAN=true`
9. set `SCHEDULED_SCAN_TIME` a few minutes ahead
10. restart the server and confirm the scheduled scan runs

## Troubleshooting

- Android cannot reach `localhost`
- use the PC LAN IP
- Windows firewall may block port `5055`
- NAS credentials must be saved on Windows for the running account
- UNC paths must be escaped correctly in `.env`
- bearer token mismatch returns `401`
- no photos for a date may be due to EXIF timestamp differences
- HEIC thumbnail generation may depend on host image codec support
- `/folders` and `/folder-photos` reject absolute paths and `..` traversal outside `PHOTO_LIBRARY_ROOT`

## Expected mobile behavior

- use mock mode by default
- switch to NAS mode only when `EXPO_PUBLIC_PHOTO_SOURCE_MODE=nas`
- if the NAS API is down, return empty results or nulls instead of crashing
- continue saving memory photo references even when preview lookups fail later
- keep local phone refs readable even before automatic NAS relink exists

Future picker-oriented improvements:
- optional local thumbnail cache if network latency ever makes it necessary
