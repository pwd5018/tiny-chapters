# Tiny Chapters Architecture

## Overview

Tiny Chapters is being structured so the UI can stay stable while the underlying storage changes over time.

## Mobile App

- React Native / Expo
- Screens call services
- Services hide storage implementation
- Root auth gate decides whether to show the signed-in app or the email auth flow

The `app/` routes should not need to know whether memories come from mock state, Supabase, or another source later.

Tiny Chapters now also has a local reminder layer for device-only habit nudges:

- reminder settings are stored in AsyncStorage
- local notification scheduling is handled through `expo-notifications`
- no reminder preferences are stored in Supabase yet

## Memory Storage

- Supabase now
- Repository abstraction remains in place for future changes

Current memory operations are exposed through a repository-style service:

- `getMemories()`
- `getMemoryById(id)`
- `createMemory(input)`
- `updateMemory(id, input)`
- `deleteMemory(id)`
- `updateMemoryPhotoRefs(memoryId, attachedPhotos)`
- `searchMemories(query)`

That lets the app migrate from in-memory data to Supabase without changing the screen contracts much.

The repository is also where:
- Supabase rows are mapped to app-level `Memory` objects
- `attachedPhotos` are stitched in from `memory_photo_refs`
- memory edits and deletes stay behind a service boundary instead of calling Supabase from screens
- future export and cleanup logic can stay isolated from the screens

## Auth

- Email/password sign up and sign in through Supabase Auth
- Session persistence via Expo SecureStore
- Screens do not talk to Supabase Auth directly

`src/services/auth/authService.ts` exposes the auth operations, while `src/services/auth/AuthProvider.tsx` keeps session state available to the app shell.

## Notifications

- local notifications only
- device-local reminder settings
- no AI-generated reminder content yet

`src/services/notifications/reminderService.ts` owns:

- notification permission requests
- Android channel setup
- local reminder scheduling and cancellation
- persisted reminder settings

Current reminder settings include:

- `enabled`
- `cadence`
- `time`
- `daysOfWeek`
- `promptStyle`
- `lastUpdatedAt`

Reminder prompt styles are currently fixed:

- `simple`
- `family`
- `reflection`

The app shell can reschedule reminders on startup, and Settings is the main UI for editing the reminder habit engine.

## Photo Storage

- NAS remains source of truth
- App stores only photo references
- Future NAS Photo API will index photos by stable IDs/content hashes

Memories now store `attachedPhotos` as lightweight references instead of copied image assets. This prepares the app for a model where photo metadata is searchable while the actual file stays on the NAS.

The mobile app now has two client-side photo source modes:

- `mock`
- `nas`

`src/services/photo/photoService.ts` chooses the active provider using Expo public env vars, while the screens stay provider-agnostic.

NAS thumbnails are served by the Photo API itself. They are not stored in Supabase, and the original full-size photo remains on the NAS.

When a memory is edited later, Tiny Chapters can update or remove photo references, but those changes still affect only the reference rows. The original NAS or phone photo is not deleted.

The photo provider contract now includes:

- `getPhotosByDate(date)`
- `searchPhotos({ q, date, from, to, limit, offset })`
- `getFolders(path?)`
- `getFolderPhotos(path, { limit, offset })`
- `getPhotoById(photoId)`
- `matchPhotoCandidate(candidate)`

Tiny Chapters now also tracks attachment durability inside each `AttachedPhotoRef`:

- `linked_to_nas` for durable NAS-backed references
- `pending_nas_match` for phone-captured or manually attached local refs
- `local_only`, `missing`, and `preserved_copy` reserved for later workflows

When a local ref is created, the app now attempts an immediate NAS match using conservative metadata matching:

- filename
- takenAt within tolerance
- fileSize exact or near
- width and height

If the match is strong enough, the local ref is converted to a durable NAS ref immediately. Otherwise it stays pending.

Pending local refs can later be promoted without rewriting the UI flow:

- app startup can silently retry all pending NAS matches in the background
- Settings can trigger a manual retry across all memories
- memory detail can retry relinking for that specific memory when it opens

That durability path is:

1. A memory saves with `source: "local"` and `syncStatus: "pending_nas_match"`.
2. The phone backs the original photo up to the NAS.
3. The Photo API scan indexes that file.
4. Tiny Chapters matches the temporary local metadata against the NAS index.
5. The ref is promoted to `source: "nas"` and `syncStatus: "linked_to_nas"`.

No photo copies are uploaded to Supabase during that promotion. Only the reference row changes.

## Future NAS Photo API

- `GET /photos?date=YYYY-MM-DD`
- `GET /photos/:photoId`

The future photo API should return indexed metadata such as:

- stable `photoId`
- path
- taken date
- thumbnail/view URLs
- content hash when available

The current NAS Photo API also supports paged library browsing:

- `GET /photos/search`
- `GET /folders`
- `GET /folder-photos`

Folder paths are always relative to `PHOTO_LIBRARY_ROOT`, normalized on the server, and rejected if they attempt absolute-path access or `..` traversal outside the configured root.

The contract details live in:

- [docs/nas-photo-api.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\nas-photo-api.md)

## Current Flow

1. Today asks the photo provider for photos on the selected day.
2. The user can also take a photo, attach one from the phone, or open the dedicated NAS picker screen.
3. The NAS picker uses Photo API thumbnail URLs plus a lightweight full-image preview.
4. The NAS picker can switch between By Date, Search, and Folders modes with a native date picker.
5. NAS or mock selections save as durable `linked_to_nas` refs.
6. Phone-local attachments first attempt an immediate NAS relink.
7. If matched, they save as durable `linked_to_nas` refs right away.
8. If not matched, they save as `pending_nas_match` refs with temporary device metadata only.
9. The memory repository stores attached photo references alongside the written memory.
10. Timeline and Search read memories through the repository layer.
11. Memory detail can edit text, date, prompt, tags, and attachment refs through the repository plus the shared NAS picker context.
12. Memory detail can also auto-retry pending NAS matches for that one memory and refresh if a durable relink succeeds.
13. Settings reads auth/session state from the auth service layer, explains the durability model, shows simple durability counts, and can retry pending NAS matches across all memories.
14. Settings also edits reminder cadence, time, prompt style, and notification permissions through the reminder service.
15. Today can show a subtle reminder hint when local reminders are enabled on the device.

## Reminder flow

1. The user enables reminders in Settings.
2. Tiny Chapters requests Android notification permission if needed.
3. Reminder settings are saved in AsyncStorage.
4. The reminder service schedules local notifications using the selected cadence and time.
5. When the user taps a reminder, the app opens and routes back toward Today when practical.

No reminder flow uploads photos, changes NAS storage, or adds AI-generated copy.

## Why this prepares for Supabase and NAS

- Supabase can later store structured memory rows without needing to own photo binaries.
- The NAS can continue to store originals and expose them through an indexing layer.
- Exports can include both memory content and durable photo references.
- Future AI cleanup can operate on memory text and photo metadata without changing the UI contracts.

## Supabase schema

The current schema and RLS policies live in:

- [supabase/migrations/20260619_phase2_memories.sql](C:\Users\wolf-ai\Workspace\tiny-chapters\supabase\migrations\20260619_phase2_memories.sql)

That migration creates:

- `profiles`
- `memories`
- `memory_photo_refs`

and enables row-level security so users can only access their own rows.

`memory_photo_refs.memory_id` already references `memories(id) on delete cascade`, so deleting a memory removes its linked reference rows automatically while leaving original photos untouched.

It also:

- creates an `auth.users` trigger that auto-inserts a matching `profiles` row
- backfills `profiles` for any already-existing auth users

For Phase 3.8, also run:

- [supabase/migrations/20260621_phase38_photo_durability.sql](C:\Users\wolf-ai\Workspace\tiny-chapters\supabase\migrations\20260621_phase38_photo_durability.sql)

That migration expands `memory_photo_refs` with metadata needed for temporary local refs:

- `filename`
- `taken_at`
- `file_size`
- `width`
- `height`
- `local_uri`
- `sync_status`
