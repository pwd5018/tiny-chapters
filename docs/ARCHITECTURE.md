# Tiny Chapters Architecture

This file documents the architecture that exists in the repo today. If implementation and roadmap/history diverge, prefer the code and update this file.

## High-level diagram

```text
Mobile App -> Supabase Auth + Postgres
Mobile App -> Photo API -> Windows-accessible NAS Share
```

Notes:

- Supabase stores users, memories, tags-as-array data, and photo reference metadata.
- Supabase does not store original photos.
- Supabase does not currently store thumbnails.
- The Photo API is a separate local service under `photo-api/`.
- The primary development runtime is now an installed Expo Development Build, not Expo Go.

## Development runtime model

- Daily development target
  Installed Expo Development Build on a physical Android phone.
- Fast inner loop
  Metro plus hot reload through `npm run dev`.
- Quick experiments only
  Expo Go, when native behavior is not under test.

Why this changed:

- `expo-notifications` is not a trustworthy validation path in Expo Go on Android.
- real permission prompts, device networking, and notification behavior belong in the installed dev build.
- this phase is still developer-experience work, not release work.

## Mobile app structure

- `app/`
  Expo Router routes and app-shell composition. Main routes are Today, Timeline, Search, Settings, `photo-picker`, `memory/[id]`, and hidden `developer/diagnostics`.
- `src/components/`
  Reusable UI such as `DatePickerField`, `TimePickerField`, memory cards, auth screen, and prompt cards.
- `src/services/`
  Service boundaries for auth, memories, photos, reminders, and diagnostics.
- `src/types/`
  Domain models for memories, photos, and reminder settings.
- `src/config/`
  Runtime config such as environment labeling, photo source selection, runtime detection, and NAS Photo API env handling.
- `src/theme/`
  Shared theme tokens.

## Service boundaries

- `memoryService`
  Repository-style boundary for CRUD, search, daily prompt selection, and `memory_photo_refs` persistence. Screens should not query Supabase directly for memory data.
- `photoService`
  Selects the active provider (`mock` or `nas`) and exposes shared operations such as date lookup, search, folders, connection tests, and match requests.
- `nasPhotoProvider`
  Typed HTTP client for the Photo API. Handles auth headers, response normalization, graceful fallback, and request timeouts.
- `photoRelinkService`
  Owns pending NAS match queries, conservative metadata matching requests, relink retries, and durability summaries.
- `reminderService`
  Owns device-local reminder settings, notification permissions, schedule/cancel logic, and reminder descriptions.
- `diagnosticsService`
  Owns Developer Mode state, masked environment snapshots, startup diagnostics, Supabase checks, Photo API checks, relink diagnostics, notification diagnostics, and diagnostics event logs.

Supplemental:

- `photoAttachmentContext`
  Shared in-memory attachment state across Today, memory detail, and the dedicated picker.
- `DeveloperEnvironmentBanner`
  Developer-only runtime banner that exposes the current environment, runtime, photo source, Photo API URL, Supabase URL, and platform without showing secrets.

## Supabase data model

Current migrations:

- `supabase/migrations/20260619_phase2_memories.sql`
- `supabase/migrations/20260621_phase38_photo_durability.sql`

Tables:

- `profiles`
  Per-user profile row keyed to `auth.users.id`. Present in the repo and auto-created via trigger.
- `memories`
  `id`, `user_id`, `date`, `prompt`, `text`, `tags text[]`, `created_at`, `updated_at`.
- `memory_photo_refs`
  `memory_id`, `user_id`, `photo_id`, `source`, `path`, `content_hash`, `attached_at`, `filename`, `taken_at`, `file_size`, `width`, `height`, `local_uri`, `sync_status`.

Tags strategy:

- Tags are currently stored inline as `text[]` on `memories`.
- There is no separate `tags` table yet.
- Search is currently app-side string matching across memory fields and attachment metadata.

RLS expectations:

- `profiles`, `memories`, and `memory_photo_refs` all have RLS enabled.
- Policies are owner-scoped with `auth.uid() = id` for profiles and `auth.uid() = user_id` for memory tables.
- Deleting a memory cascades to `memory_photo_refs` but never deletes the original photo.

## Photo reference model

`AttachedPhotoRef` fields:

- `photoId`
- `source`
- `path`
- `attachedAt`
- `contentHash?`
- `filename?`
- `takenAt?`
- `fileSize?`
- `width?`
- `height?`
- `localUri?`
- `syncStatus`

Current `syncStatus` values:

- `local_only`
- `pending_nas_match`
- `linked_to_nas`
- `missing`
- `preserved_copy`

Practical meaning today:

- NAS picker attachments save as durable NAS references.
- Phone-attached or camera-captured refs are metadata-only local refs first.
- Local refs try immediate relink and otherwise remain `pending_nas_match`.
- Relink can later promote them to `linked_to_nas`.

## NAS Photo API

Purpose:

- Index a Windows-accessible NAS photo library.
- Generate stable photo metadata for the app.
- Serve thumbnails and full-image views without copying originals into Supabase.
- Support conservative metadata matching for local-to-NAS relink.

Location:

- `photo-api/`

Major endpoints:

- `/health`
- `/status`
- `/index/scan`
- `/index/cancel`
- `/photos?date=`
- `/photos/search`
- `/folders`
- `/folder-photos`
- `/photos/:photoId`
- `/photos/:photoId/thumb`
- `/photos/:photoId/view`
- `/photos/match`

Operational behavior implemented now:

- Bearer-token auth for all routes except `/health`
- SQLite-backed photo index and scan history
- EXIF/date extraction with fallbacks
- Stable IDs derived from content hashes
- Missing-file tracking instead of immediate destructive deletion
- Overlap protection for scans
- Root reachability checks
- Scheduled/background scan support inside the service process
- CLI `scan` and `status` entry points

## Thumbnail strategy

- Thumbnails are generated and served by the Photo API.
- Thumbnails are cached locally by the Photo API under `THUMBNAIL_CACHE_DIR`.
- Thumbnails are not stored in Supabase.
- The mobile app displays Photo API URLs and attaches bearer auth headers when needed.

## Authentication and security

- App users authenticate with Supabase Auth.
- The app authenticates to the Photo API with a bearer token.
- The mobile app must not store NAS or Synology username/password credentials.
- The Photo API relies on the Windows host account's filesystem access to the NAS share.
- Prefer UNC paths over mapped drives for operational reliability.
- There are no public photo buckets in Supabase for this workflow.
- Secrets should remain masked in diagnostics and logs.

## Remote access plan

- Current expected access pattern: local LAN.
- Preferred future personal remote access: Tailscale to the Photo API host.
- Longer-term product/cloud options remain future work and should not be backfilled into current MVP docs.

## Current environment strategy

- `EXPO_PUBLIC_APP_ENV`
  Public app environment label. Use `development` now and reserve `production` for later release work.
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE`
  Chooses `mock` or `nas`.
- `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`
  Single source of truth for LAN, future Tailscale, or future cloud endpoint switching.

All `EXPO_PUBLIC_*` values are bundled into the app. They are configuration, not secrets.

## Failure behavior

- NAS unavailable
  - Photo API health may stay up while `/status` shows `rootReachable: false`.
  - Existing memories remain readable because references are still stored in Supabase.
- Photo API unavailable
  - NAS provider requests fail gracefully and return empty results or nulls instead of crashing the app.
  - Durable refs remain stored even if preview lookup fails.
- Supabase unavailable or unconfigured
  - Auth and memory CRUD cannot proceed.
  - Diagnostics can still report configuration state safely.
- Local photo refs missing
  - The app should still render the memory; those refs are temporary and device-specific.
- Pending relink state
  - `pending_nas_match` means the app has metadata only and is waiting for a safe NAS match.
  - Retry paths exist at app startup, memory detail, and Settings.

## Phase-history discrepancy note

The provided phase history broadly matches the repo. The main documentation discrepancy was that the older lowercase architecture doc still described parts of the Photo API and relink flow as future work even though the code already implements them.
