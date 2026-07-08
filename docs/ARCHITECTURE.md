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
  Expo Router routes and app-shell composition. Main routes are Today, Moments, Search, Settings, focused `write`, `photo-picker`, `memory/[id]`, and hidden `developer/diagnostics`.
- `src/components/`
  Reusable UI such as `DatePickerField`, `TimePickerField`, memory cards, auth screen, prompt cards, and the shared `ScreenHero` pattern used across the redesigned main screens.
- `src/features/dashboard/`
  Modular Today dashboard feature with typed card models, async dashboard service, card registry, and reusable card-list rendering for Phase 9.1 placeholders and future dashboard sections.
- `src/features/write/`
  Focused writing-flow state and UI for the dedicated `write` route, including draft state shared with Today dashboard guidance and the Phase 10 guided-memory draft seam.
- `src/services/ai/`
  Client-side gateway wrapper for guided follow-up and polish requests. The mobile app calls the local backend gateway instead of storing provider secrets in the Expo bundle.
- `src/services/`
  Service boundaries for auth, memories, photos, reminders, diagnostics, and permissions.
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
- `aiService`
  Calls the protected local AI gateway routes exposed by `photo-api/` for guided follow-up generation and optional memory cleanup or polish suggestions.
- `reminderService`
  Owns device-local reminder settings, schedule/cancel logic, Android notification-channel setup, and reminder descriptions.
- `permissionService`
  Centralizes notification, camera, and media-library permission status/request helpers so screens do not need direct Expo permission calls.
- `diagnosticsService`
  Owns Developer Mode state, masked environment snapshots, startup diagnostics, Supabase checks, Photo API checks, relink diagnostics, notification diagnostics, iOS readiness diagnostics, and diagnostics event logs.

Supplemental:

- `photoAttachmentContext`
  Shared in-memory attachment state across Today, memory detail, and the dedicated picker.
- `WriteDraftProvider`
  Keeps the in-progress writing draft separate from the Today landing screen so dashboard guidance can stay aware of write-state without reintroducing a second writing path. It now also holds the first Phase 10 guided-memory draft shape: base question, original answer, future follow-up slots, and composed memory text.
- `dashboardService`
  Returns typed dashboard cards for the Today experience. The current lighter Today flow keeps this focused on prior-year On This Day memories and daily prompt guidance rather than draft, photo, or stats sections.
- `DeveloperEnvironmentBanner`
  Developer-only runtime banner that exposes the current environment, runtime, photo source, Photo API URL, Supabase URL, and platform without showing secrets.

Phase 11 result:

- `photoService` now supports device-aware browsing behavior in addition to NAS and mock flows.
- `photo-picker` now acts as a shared `Device | NAS` attachment surface instead of keeping phone-library selection as a Write-only special case.
- Durability behavior now distinguishes local-only, pending NAS match, and NAS-linked refs more clearly, and linked refs should prefer NAS-backed preview paths once relink succeeds.

## Today screen composition

- The Today tab is now card-driven at the top of the screen.
- `app/(tabs)/index.tsx` now acts as a lighter landing screen: it asks the dashboard feature for cards, renders loading/empty/error states through reusable dashboard components, and sends users into the dedicated `write` route for composition.
- Phase 9.2 upgrades the `on_this_day` card from a placeholder into a real resurfacing card backed by `memoryService.getOnThisDayMemories(...)`.
- Phase 9.3 adds richer `daily_prompt` behavior and real On This Day resurfacing while keeping card composition inside `src/features/dashboard/`.
- The lighter Today route now loads memory-backed dashboard data once and stays intentionally sparse, leaving writing and photo picking inside the dedicated `write` route.
- The redesigned Today header is intentionally slim: app name plus date, then the dashboard flow. It should stay calmer than Moments and should not become a second full composition screen again.
- The dedicated `write` route now owns the fuller memory-composition experience, while the Moments tab owns browsing/stats instead of asking Today to do both jobs at once.
- Early Phase 10 groundwork should stay inside the dedicated `write` route until the guided-question UX is proven. Today may launch the flow, but should not become the place where multi-step guided writing happens.
- Phase 11 followed the same IA guardrail: photo-source improvements launch from Write, but Today does not become the place where device-library management or multi-step photo browsing lives.

## UI baseline after redesign

- `ScreenHero` provides the shared top-of-screen visual language for Moments, Search, and Write.
- Today intentionally uses a slimmer custom header instead of the full hero treatment so the dashboard cards remain the primary focus.
- `MemoryCard` now uses a warmer editorial treatment and acts as the baseline visual pattern for archive browsing.
- Form and picker surfaces such as `DatePickerField` and the Write route controls have been warmed up to match the redesigned cards and hero components.
- Future milestone work should build on this calmer single-path IA rather than reintroducing multiple write entry points or dense Today-screen utility sections.

## Phase 10 guided-memory model

- Tiny Chapters now has a guided-memory draft seam in write-state plus a small persistence seam in Supabase.
- The draft shape keeps four concepts separate:
  - `baseQuestion`
  - `originalAnswer`
  - `followUps`
  - `composedText`
- It now also reserves a separate `polishedSuggestion` so optional cleanup can remain suggestion-based instead of overwriting the draft by default.
- The Write route now includes guided follow-up behavior:
  - generate up to 3 gentle follow-up prompts from the base answer
  - allow answer or skip for each follow-up
  - keep the editable saved-memory text separate from the preserved original answer
- The Write route also includes an early local cleanup seam:
  - generate a separate polished short-form suggestion from the current guided draft
  - let the user explicitly choose whether to apply the polished version
  - avoid silent replacement of the user-authored text
- When the local AI gateway is configured, follow-up generation and polish suggestions now prefer the gateway and only fall back to local deterministic helpers if the gateway is unavailable.
- Saved memories can now persist guided context as JSON in `memories.guided_context`, including the base question, original answer, follow-ups, and polished suggestion when present.
- This keeps the primary memory model simple (`memories.text` remains the saved memory body) while preserving the guided-writing context for future edit/history improvements.

## Supabase data model

Current migrations:

- `supabase/migrations/20260619_phase2_memories.sql`
- `supabase/migrations/20260621_phase38_photo_durability.sql`
- `supabase/migrations/20260703_phase10_guided_memory_context.sql`

Tables:

- `profiles`
  Per-user profile row keyed to `auth.users.id`. Present in the repo and auto-created via trigger.
- `memories`
  `id`, `user_id`, `date`, `prompt`, `text`, `tags text[]`, `guided_context jsonb`, `created_at`, `updated_at`.
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
- `localUri` remains temporary and device-specific for local refs only. Once a ref is promoted to `linked_to_nas`, the app should prefer the NAS-backed preview path instead of continuing to depend on the temporary device URI.

Phase 11 result:

- Device-library photos are now a first-class source without breaking the existing local-to-NAS relink behavior.
- Browsing source and relink capability are now separate concerns.
- Saved-memory rendering now prefers NAS-backed preview paths once a local ref has been promoted to `linked_to_nas`.

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

Platform note:

- `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL` must point to a URL the phone itself can reach. `localhost` only works from the same device, not from an iPhone talking to a Windows host.

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
