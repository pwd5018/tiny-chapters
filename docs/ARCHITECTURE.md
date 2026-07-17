# Tiny Chapters Architecture

This file documents the architecture that exists in the repo today. If implementation and roadmap/history diverge, prefer the code and update this file.

## High-level diagram

```text
Mobile App -> Supabase Auth + Postgres
Mobile App -> Photo API -> Windows-accessible NAS Share
```

Notes:

- Supabase stores users, memories, tags-as-array data, guided context, confirmed metadata sidecars, collection membership, and attachment metadata through the still-photo-named `memory_photo_refs` table.
- Supabase does not store original photos.
- Supabase does not currently store thumbnails.
- The Photo API is a separate local service under `photo-api/`.
- The primary development runtime is now an installed Expo Development Build, not Expo Go.
- The current implementation still uses `memory` as the storage and service term, but the product direction is broadening toward a more general life-memory platform.

## Future private web companion boundary

The roadmap includes an un-numbered future side quest for a personal browser companion focused only on diary entries. The intended first web slice should reuse Supabase auth, `memoryService`, search, collections, metadata, and text writing where practical, while explicitly excluding photo/video attachments, NAS browsing and relinking, native reminders, and mobile diagnostics.

The web companion is not currently implemented. If it is built, browser-safe Supabase session persistence and browser download handling will be separate platform seams. The browser should not receive credentials intended to protect the NAS Photo API.

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
  Client-side gateway wrapper for guided opening-question generation, guided follow-up generation, and polish requests. The mobile app calls the local backend gateway instead of storing provider secrets in the Expo bundle.
- `src/services/`
  Service boundaries for auth, memories, photos, reminders, diagnostics, and permissions.
- `src/services/export/`
  Phase 13 export boundary for archive schema mapping, export filtering, JSON/Markdown formatting, print-readiness summaries, and save-first device-file handling. On Android it should prefer a remembered user-chosen export folder over hidden app storage whenever platform support allows it.
- `src/types/`
  Domain models for memories, photos, and reminder settings.
- `src/config/`
  Runtime config such as environment labeling, photo source selection, runtime detection, and NAS Photo API env handling.
- `src/theme/`
  Shared theme tokens.

## Service boundaries

- `memoryService`
  Repository-style boundary for CRUD, search, daily prompt selection, resurfacing queries, `memory_photo_refs` persistence, and the first collection/grouping seam. Search now supports model-driven filtering over text, tags, date range, guided context, and photo durability state. Daily prompt selection is now the service seam that can use AI plus same-day prompt history without pushing that logic into screens. Phase 16 collection work should extend this service instead of teaching screens to assemble collection membership directly from Supabase rows. Screens should not query Supabase directly for memory data.
  Current collection groundwork inside this seam now includes collection CRUD, memory-to-collection membership writes, and grouped reads such as loading the memories that belong to a collection.
  Search now also understands collection membership as a structured filter rather than treating larger chapters as text-only decoration.
  Phase 18 groundwork now keeps additive media metadata attached to those refs, including `mediaKind`, optional duration, mime type, and optional poster references, while leaving the current storage names stable.
  Phase 19 extends this seam with a `memory_metadata` sidecar for confirmed metadata and lifecycle state, plus `memory_metadata_suggestions` for unconfirmed AI proposals. Favorite flags, importance, people, places, projects, topics, and finalized state live in confirmed storage instead of being implied from free-form text or AI output. Suggestions are generated from saved chapter text only, must include exact text evidence, and require explicit approval before promotion.
  Future domain expansion should continue to build around this seam rather than encouraging direct cross-app reads of Supabase tables. If Tiny Chapters later becomes a provider for the Personal Assistant, the provider layer should still sit above the repository model rather than bypass it.
- `photoService`
  Selects the active provider (`mock` or `nas`) and exposes shared operations such as date lookup, search, folders, connection tests, and match requests.
- `nasPhotoProvider`
  Typed HTTP client for the Photo API. Handles auth headers, response normalization, graceful fallback, and request timeouts.
- `photoRelinkService`
  Owns pending NAS match queries, conservative metadata matching requests, relink retries, and durability summaries.
- `aiService`
  Calls the protected local AI gateway routes exposed by `photo-api/` for guided opening-question generation, guided follow-up generation, and optional memory cleanup or polish suggestions.
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
  Returns typed dashboard cards for the Today experience. The current lighter Today flow keeps this focused on daily prompt guidance plus memory resurfacing such as prior-year On This Day and a random older-memory card rather than draft, photo, or stats sections.
- `exportService`
  Phase 13 foundation for building a canonical archive export from existing memories. It preserves enough photo identity plus print-readiness metadata for future book-building workflows without claiming to own original image binaries.
  Phase 16 extends that export seam so collection membership survives in the archive payload and formatted Markdown output instead of disappearing outside the app.
- `DeveloperEnvironmentBanner`
  Developer-only runtime banner that exposes the current environment, runtime, photo source, current Metro dev-server URL/path, Photo API URL/path, Supabase URL, and platform without showing secrets.

Phase 11 result:

- `photoService` now supports device-aware browsing behavior in addition to NAS and mock flows.
- `photo-picker` now acts as a shared `Device | NAS` attachment surface instead of keeping phone-library selection as a Write-only special case.
- Durability behavior now distinguishes local-only, pending NAS match, and NAS-linked refs more clearly, and linked refs should prefer NAS-backed preview paths once relink succeeds.

## Today screen composition

- The Today tab is now card-driven at the top of the screen.
- `app/(tabs)/index.tsx` now acts as a lighter landing screen: it asks the dashboard feature for cards, renders loading/empty/error states through reusable dashboard components, and sends users into the dedicated `write` route for composition.
- Phase 9.2 upgrades the `on_this_day` card from a placeholder into a real resurfacing card backed by `memoryService.getOnThisDayMemories(...)`.
- Phase 9.3 adds richer `daily_prompt` behavior and real On This Day resurfacing while keeping card composition inside `src/features/dashboard/`.
- Phase 15 extends that same pattern further: the daily prompt is now a service-backed seam that can reuse an unused question for the date, vary the question after same-day saves, and pair with a random older-memory resurfacing card without pushing archive browsing back into Today.
- The lighter Today route now loads memory-backed dashboard data once and stays intentionally sparse, leaving writing and photo picking inside the dedicated `write` route.
- The redesigned Today header is intentionally slim: app name plus date, then the dashboard flow. It should stay calmer than Moments and should not become a second full composition screen again.
- The dedicated `write` route now owns the fuller memory-composition experience, while the Moments tab owns browsing/stats instead of asking Today to do both jobs at once.
- Phase 16 should follow the same IA rule: larger archive groupings belong in Moments-first collection browsing rather than adding another dense archive section to Today.
- The first collection-browsing pass now follows that rule directly: `app/(tabs)/timeline.tsx` surfaces collection cards above the recent-memory list, and `app/collection/[id].tsx` drills into one collection's memories without changing Today or expanding Write.
- The first collection-assignment pass follows the same rule too: `src/features/write/WriteMemoryScreen.tsx` offers optional save-time collection assignment, while `app/memory/[id].tsx` provides stronger post-save collection editing. This keeps Write focused on the memory first instead of turning it into a taxonomy screen.
- Manual-first starter templates now extend that same assignment surface instead of creating a new management flow. The current template set is Vacation, School Year, Holiday, and Kid Chapter, and it is intentionally manual-first rather than AI-driven.
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
- `supabase/migrations/20260712_phase18_media_generalization.sql`
- `supabase/migrations/20260712_phase19_metadata_lifecycle_foundation.sql`
- `supabase/migrations/20260712_phase19_inferred_metadata_suggestions.sql`

Tables:

- `profiles`
  Per-user profile row keyed to `auth.users.id`. Present in the repo and auto-created via trigger.
- `memories`
  `id`, `user_id`, `date`, `prompt`, `text`, `tags text[]`, `guided_context jsonb`, `created_at`, `updated_at`.
- `memory_metadata`
  `memory_id`, `user_id`, `lifecycle_status`, `is_favorite`, `importance`, `people text[]`, `places text[]`, `projects text[]`, `topics text[]`, `created_at`, `updated_at`.
- `memory_metadata_suggestions`
  Pending, approved, or rejected AI metadata proposals. Each row records a field, proposed value, optional confirmed-vocabulary match, confidence, provider/model provenance, and review timestamp. Pending suggestions never alter confirmed metadata.
- `memory_photo_refs`
  `memory_id`, `user_id`, `photo_id`, `media_kind`, `source`, `path`, `content_hash`, `attached_at`, `filename`, `taken_at`, `file_size`, `width`, `height`, `duration_ms`, `mime_type`, `local_uri`, `poster_path`, `poster_local_uri`, `sync_status`.

Phase 16 direction:

- Collection data should become a first-class seam rather than hiding larger story structure inside free-form tags alone.
- A memory should be able to belong to multiple collections such as both a school year and a family vacation.
- The expected shape is a collection table plus a membership/join table, owned by the same user-scoped service and RLS pattern as the rest of the archive data.

Tags strategy:

- Tags are currently stored inline as `text[]` on `memories`.
- There is no separate `tags` table yet.
- Search is currently model-driven but still app-side over loaded memories. It supports free text plus structured filters for tags, date range, guided context presence, photo presence, and attachment durability metadata.

### Current domain limitation

The current model is still explicitly memory-first and still keeps legacy photo-shaped names even though the ref payload is beginning to generalize:

- `memories` is the primary durable record table
- `memory_photo_refs` is still photo-only in naming even though the row shape now supports broader media metadata
- tags are still inline `text[]`
- guided context is stored inline as `guided_context jsonb`

That is acceptable for the current app, but it is not the final target shape for a broader life-memory platform.

### Recommended domain evolution

The current `memory` model should evolve additively into a broader chapter-style domain rather than being replaced abruptly.

Recommended direction:

- keep `memories` as the current durable primary-record table until a rename is clearly justified
- add side tables for confirmed metadata, inferred metadata, relationships, drafts, embeddings, and access logs
- generalize `memory_photo_refs` into a broader media-reference seam later so video and voice can fit naturally
- preserve the difference between user-authored truth, approved derived metadata, unconfirmed inference, and temporary context

Completed Phase 19 outcome:

- confirmed metadata now has its own sidecar seam in `memory_metadata`
- this sidecar is user-confirmed only
- inferred or AI-generated metadata still does not belong in the durable confirmed seam without explicit approval
- `memory_metadata_suggestions` holds user-triggered metadata proposals separately and only copies an approved suggestion into `memories.tags` or `memory_metadata`
- Phase 20.1 adds `memory_entities`, `memory_entity_aliases`, and `memory_entity_memberships` as an additive canonical vocabulary and retrieval seam. Existing confirmed arrays remain compatible, while canonical names and aliases provide stable matching identities.
- Phase 20.2 adds deterministic retrieval ranking, limit/offset inputs, explicit Any/All entity-filter semantics, and a stable context projection carrying source, lifecycle trust, match provenance, entity IDs, and a memory deep link. This remains an internal application-service contract until Phase 21 defines authorization.
- Phase 21 completes the provider boundary for the current mobile/service layer above the repository model. `providerTypes.ts` defines the versioned retrieval contract and initial `memories:read` scope; `providerService.ts` owns provider grants, revocation state, and retrieval access-log writes; `providerAdapter.ts` validates active grants, forces finalized-only visibility, validates `/memory/:id` deep links, and returns the contract-shaped context. The `memory_provider_grants` and `memory_provider_access_logs` tables are owner-scoped with RLS. No consumer should call retrieval or read Supabase tables directly; external transport is a Phase 22 concern.
- optional AI polish preserves follow-up question-and-answer pairs so it cannot blend distinct participants or roles; the local fallback retains only unambiguous source text
- a separate user draft-save workflow is intentionally deferred; assistant-proposed drafts remain a later provider-boundary capability

Future integration rule:

- another app, including the Personal Assistant, should not read these tables directly
- Tiny Chapters should later expose controlled provider services or APIs above this model

RLS expectations:

- `profiles`, `memories`, `memory_metadata`, `memory_metadata_suggestions`, `memory_entities`, `memory_entity_aliases`, `memory_entity_memberships`, and `memory_photo_refs` all have RLS enabled.
- Policies are owner-scoped with `auth.uid() = id` for profiles and `auth.uid() = user_id` for memory tables.
- Deleting a memory cascades to `memory_photo_refs` but never deletes the original photo.

## Photo reference model

`AttachedPhotoRef` fields:

- `photoId`
- `mediaKind?`
- `source`
- `path`
- `attachedAt`
- `contentHash?`
- `filename?`
- `takenAt?`
- `fileSize?`
- `width?`
- `height?`
- `durationMs?`
- `mimeType?`
- `localUri?`
- `posterPath?`
- `posterLocalUri?`
- `syncStatus`

Current `syncStatus` values:

- `local_only`
- `pending_nas_match`
- `linked_to_nas`
- `missing`
- `preserved_copy`

Practical meaning today:

- NAS picker attachments save as durable NAS references.
- Phone-attached or camera-captured photos save as metadata-only local refs first.
- Device-library videos now also save as metadata-first local refs through the same seam.
- Local refs try immediate relink and otherwise remain `pending_nas_match`.
- Photo relink can later promote matching photo refs to `linked_to_nas`.
- Video refs currently remain local or pending because NAS video indexing and matching are not implemented yet.
- `localUri` remains temporary and device-specific for local refs only. Once a ref is promoted to `linked_to_nas`, the app should prefer the NAS-backed preview path instead of continuing to depend on the temporary device URI.
- Non-photo refs can now also carry optional poster metadata, but poster generation is still future work.

Phase 11 result:

- Device-library photos are now a first-class source without breaking the existing local-to-NAS relink behavior.
- Browsing source and relink capability are now separate concerns.
- Saved-memory rendering now prefers NAS-backed preview paths once a local ref has been promoted to `linked_to_nas`.

### Future media direction

The current attachment model is intentionally photo-specific today, but the broader product should support:

- photos
- video
- later voice-note attachments

Recommendation:

- treat video support as part of a broader media-generalization phase
- keep original binaries outside Supabase
- preserve durable references, attachment metadata, and relink/durability state
- extend export and future retrieval contracts around generalized media rather than special-casing video as a one-off

Current repo status:

- local device-library video refs are now accepted through the shared picker
- generalized media metadata is persisted additively through `memory_photo_refs`
- saved chapter surfaces now show non-photo attachments with media-aware fallback cards and duration cues instead of assuming every attachment should resolve to an image thumbnail
- archive export now summarizes media mix and preview coverage in addition to the older photo-oriented durability counters
- current NAS provider, index, matching, and preview enrichment remain photo-backed

## Future provider boundary

Tiny Chapters should be designed as a standalone app that can later act as a secure life-memory provider for trusted clients such as the Personal Assistant.

Principles:

- Tiny Chapters owns durable life records and their retention rules.
- Consumers should use application services or APIs, not direct table reads.
- Retrieved results should preserve source identity, trust level, permissions, and provenance.
- Assistant-proposed content should enter Tiny Chapters as drafts pending approval rather than as silently committed truth.
- Temporary assistant context and cached external lookup results should stay outside Tiny Chapters unless the user intentionally promotes them.

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
- SQL-backed filtering, sorting, counting, and pagination for photo search and folder browsing
- EXIF/date extraction with fallbacks
- Stable IDs derived from content hashes
- Missing-file tracking instead of immediate destructive deletion
- Overlap protection for scans
- Root reachability checks
- Scheduled/background scan support inside the service process
- Bounded concurrent file processing during scans, with progress checkpoints and scan overlap protection
- CLI `scan` and `status` entry points

## Thumbnail strategy

- Thumbnails are generated and served by the Photo API.
- Thumbnails are cached locally by the Photo API under `THUMBNAIL_CACHE_DIR`.
- Concurrent requests for the same uncached thumbnail share one in-flight generation.
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

## Phase 13 export model

- Export should stay read-only and service-driven.
- The canonical archive export should be built from the existing `Memory` model and attached photo refs rather than from new direct Supabase queries in screens.
- The first user-facing entrypoint now lives in Settings, while Today and Moments remain focused on capture and browsing rather than export management.
- Export should include:
  - memory text, prompt, date, tags, and timestamps
  - guided-writing context when present
  - photo manifest entries with stable identity fields such as `photoId`, `path`, `filename`, `contentHash`, `takenAt`, `source`, and `syncStatus`
  - archive metadata such as schema version, export timestamp, and filter summary
  - export-level date-span, tag, and print-readiness summaries
  - per-memory print-readiness labels and notes
  - explicit pending NAS match and missing-photo review lists for later manual or local-tool triage
- Export should not include:
  - original photo binaries
  - secrets, auth state, or environment values
  - claims that every exported photo is presently reachable on-device
- Later book-builder work should be able to consume the canonical export and resolve actual originals from NAS or local storage in a separate local workflow.
- The mobile app still stops at manifest generation and file save. Actual photo gathering, layouting, or print submission remains out of scope for this repo phase.

## Phase-history discrepancy note

The provided phase history broadly matches the repo. The main documentation discrepancy was that the older lowercase architecture doc still described parts of the Photo API and relink flow as future work even though the code already implements them.
