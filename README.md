# Tiny Chapters

Tiny Chapters is a private mobile memory capsule for saving small daily family moments. The app is Android-first, built with Expo Router and TypeScript, and is being structured so the storage layer can evolve without forcing major screen rewrites.

## Project Context Docs

Future AI coding agents and maintainers should read these first:

- [docs/AI_CONTEXT.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\AI_CONTEXT.md)
- [docs/ARCHITECTURE.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ARCHITECTURE.md)
- [docs/ROADMAP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ROADMAP.md)
- [docs/DEVELOPMENT_SETUP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\DEVELOPMENT_SETUP.md)
- [docs/IOS_READINESS.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\IOS_READINESS.md)

These files are the canonical startup context and should be updated after each completed phase or meaningful architecture, data model, or roadmap change.

## Phase 7 status

Current state:
- Expo mobile shell with tab navigation
- Supabase-backed auth and memory persistence
- Mock photo provider for same-day photo references
- Camera capture and phone photo attach for temporary local refs
- NAS photo picker screen with real date picker, backend search, folder browsing, paging, multi-select, and lightweight preview
- Memory detail screen with edit and delete flows
- Timeline and Search cards open a full memory detail route
- Existing memories can add or remove photo references without uploading photos to Supabase
- Local reminder scheduling with `expo-notifications` and AsyncStorage-backed settings
- Hidden Developer Mode with a diagnostics screen for Supabase, NAS, relink, notification, and environment troubleshooting
- Installed Expo Development Build workflow for real device testing
- Developer-only startup environment banner and startup diagnostics
- Today, Timeline, Search, and Settings screens working against service abstractions
- Native Android project available for emulator/device work when needed

Not implemented yet:
- Full iOS support or TestFlight readiness
- AI cleanup
- Export flow
- Device photo library browsing as a primary archive source

## Developer Quick Start

Typical daily workflow:

1. Start the Photo API.
2. Start Metro.
3. Launch the installed Development Build.
4. Develop.
5. Let hot reload update the phone.
6. Test on device.
7. Commit changes.

Quick commands:

```powershell
npm run photo-api:dev
npm run dev
```

First install or after native config changes:

```powershell
npm run android
```

For a physical device target:

```powershell
npm run android:device
```

More complete setup and troubleshooting live in [docs/DEVELOPMENT_SETUP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\DEVELOPMENT_SETUP.md).

## How to run

Install dependencies:

```powershell
npm install
```

Create a `.env` file in the project root:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PHOTO_SOURCE_MODE=mock
EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055
EXPO_PUBLIC_NAS_PHOTO_API_KEY=change-me
```

You can copy the starter values from [.env.example](C:\Users\wolf-ai\Workspace\tiny-chapters\.env.example).

Start Metro:

```powershell
npm run dev
```

Run Android:

```powershell
npm run android
```

If Metro gets stuck on stale cache data:

```powershell
npm run start:clear
```

## Architecture summary

- `app/` contains Expo Router screens and navigation only
- `src/services/memoryService.tsx` exposes the memory repository interface used by screens
- `src/services/auth/` owns Supabase auth state and session persistence
- `src/services/photo/` contains the photo provider abstraction and a mock implementation
- `src/services/photo/photoService.ts` selects mock or NAS-backed photo access based on env config and exposes date, search, and folder browsing operations
- `src/services/photo/photoRelinkService.ts` holds the placeholder relink seam for future NAS matching
- `app/photo-picker.tsx` provides the dedicated NAS selection flow for durable photo refs, with paged date, search, and folder modes
- `app/memory/[id].tsx` handles memory detail, edit, delete, and attachment management
- `src/services/notifications/reminderService.ts` owns local reminder settings, permission handling, and schedule management
- `src/services/diagnostics/diagnosticsService.ts` centralizes developer-only diagnostics, safe masking, and recent diagnostic event logging
- `src/lib/supabase.ts` initializes the Supabase client with Expo env vars and SecureStore-backed auth persistence
- `src/types/` defines domain models for memories and photos

The screens talk to services, and the services hide how data is actually stored. That keeps the UI steady when we later swap mock storage for Supabase or add a real NAS-backed photo index.

Reminder settings are device-local for now:

- Tiny Chapters stores reminder cadence, time, and prompt style in AsyncStorage
- notification permissions stay on-device
- no reminder settings are written to Supabase yet

Developer diagnostics are also device-local:

- tap the app version row in Settings 7 times to enable Developer Mode
- diagnostics events keep only the most recent 50 entries
- secrets such as API keys and tokens are intentionally hidden or masked
- a developer-only startup banner shows environment, photo source, Photo API URL, Supabase URL, runtime, and platform without showing secrets

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL from [supabase/migrations/20260619_phase2_memories.sql](C:\Users\wolf-ai\Workspace\tiny-chapters\supabase\migrations\20260619_phase2_memories.sql).
3. Then run [supabase/migrations/20260621_phase38_photo_durability.sql](C:\Users\wolf-ai\Workspace\tiny-chapters\supabase\migrations\20260621_phase38_photo_durability.sql).
4. In Supabase Authentication, enable Email provider.
5. Add your project URL and anon key to `.env`.
6. Restart Metro after adding env vars:

```powershell
npx expo start -c
```

That SQL now also:
- auto-creates a `profiles` row for every new auth user
- backfills missing `profiles` rows for users who already exist

## Why photos are stored as references instead of copied

Tiny Chapters is headed toward a model where:
- memories live in Supabase
- original photos stay on the NAS

Instead of copying image files into app storage or the database, memories store stable references such as:
- `photoId`
- `source`
- `path`
- `contentHash` when available
- `syncStatus` so the app can tell whether a photo is already durable on the NAS

Editing a memory can add or remove those references later, but it still does not upload thumbnails or original photos into Supabase.

This keeps the NAS as the source of truth, avoids duplicate photo storage, and makes later re-indexing or export cleaner.

## Captured photo durability model

Tiny Chapters now treats phone-local photo refs and NAS refs differently:

- NAS-selected photos are durable and save as `linked_to_nas`
- phone-captured or manually attached photos save as temporary local refs
- local refs start as `pending_nas_match`

Tiny Chapters now also tries an immediate NAS relink right after capture or attach:

- if the NAS Photo API already has that photo, the app stores the durable NAS ref immediately
- if no safe match is found, the ref stays local and `pending_nas_match`
- matching stays conservative so the app does not link the wrong family photo by mistake

Important:
- the app stores metadata only for those local refs
- no full photos are uploaded to Supabase
- no thumbnails are uploaded to Supabase
- `localUri` is treated as temporary and device-specific only

For NAS photos:
- thumbnails come from the Photo API
- originals stay on the NAS
- Supabase still stores only references, not image binaries

Tiny Chapters now also retries pending NAS matches later:

- on app startup when NAS mode is active
- when a memory detail screen opens
- when you tap `Retry NAS Photo Matching` in Settings

The phone-photo durability flow is:

- take or attach a phone photo
- save the memory with a temporary local reference
- let the phone back up to the NAS
- let the Photo API scan index that photo
- Tiny Chapters relinks the memory to the NAS photo id
- the memory becomes durable as `Linked to NAS archive`

Tiny Chapters also supports local memory reminders on Android:

- `Daily`
- `Weekdays`
- `Weekly`

Prompt styles currently include:

- `Simple`
- `Family`
- `Reflection`

These reminders use local notifications only. No reminder data or notification payloads are uploaded to Supabase.

Reminder permission behavior:

- Tiny Chapters requests notification permission only when needed
- denied permission is handled gracefully in Settings
- Android system settings may still be needed if the OS stops showing the permission prompt

Deleting a memory removes only the memory row plus its linked `memory_photo_refs` rows. The foreign key on `memory_photo_refs.memory_id` already uses `on delete cascade`, so original NAS or phone photos are never deleted by Tiny Chapters.

This fits the workflow where your phone backs photos up to the NAS separately. A future relink phase can then convert those temporary local refs into durable NAS-linked refs after backup plus Photo API scan complete.

## Future NAS Photo API concept

The current photo layer now supports:

- `GET /photos?date=YYYY-MM-DD`
- `GET /photos/search?q=&date=&from=&to=&limit=&offset=`
- `GET /folders?path=`
- `GET /folder-photos?path=&limit=&offset=`
- `GET /photos/:photoId`

That API returns indexed NAS photo metadata, stable IDs, and optional content hashes while the app continues storing only references on each memory.

There is now also a local service foundation in:

- [photo-api/](C:\Users\wolf-ai\Workspace\tiny-chapters\photo-api)

It is designed to run on Windows or a mini PC, read from a NAS network share, and expose the LAN API the mobile app can call.

## Photo source modes

Use mock mode until a real NAS API exists:

```text
EXPO_PUBLIC_PHOTO_SOURCE_MODE=mock
```

To point the app at a NAS-backed API later:

```text
EXPO_PUBLIC_PHOTO_SOURCE_MODE=nas
EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055
EXPO_PUBLIC_NAS_PHOTO_API_KEY=change-me
```

Notes:
- On a physical Android device, `localhost` points to the phone itself, not your computer.
- Use your computer or NAS service's LAN IP address for real device testing.
- On Android emulator, special host mappings may be needed depending on where the API runs.
- Future Tailscale and cloud changes should switch only `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`, not multiple code paths.

## Local Photo API service

The standalone local photo service lives in [photo-api/](C:\Users\wolf-ai\Workspace\tiny-chapters\photo-api).

Install and run it like this:

```powershell
cd photo-api
npm install
copy .env.example .env
npm run scan
npm run dev
```

Example `photo-api/.env` for a Windows UNC NAS share:

```text
PORT=5055
PHOTO_LIBRARY_ROOT=\\\\NAS_NAME\\Photos
PHOTO_API_KEY=change-me
THUMBNAIL_CACHE_DIR=./cache/thumbnails
DATABASE_PATH=./data/photo-index.sqlite
```

Notes:
- The mobile app must use the PC or mini-PC LAN IP address, not `localhost`, when testing from a phone.
- Windows Firewall may need port `5055` opened.
- No Docker is required.

Future NAS picker improvements:
- folder browsing
- backend filename/date search
- optional local thumbnail cache if it ever becomes necessary

## Android camera capture test

1. Run both Supabase migrations.
2. Start the app with `npm start`.
3. Open Today on Android.
4. Tap `Take Photo` or `Attach from Phone`.
5. Grant permission when prompted.
6. Save a memory with that attachment.
7. Open Timeline and confirm the memory shows attached photo status, including waiting for NAS backup for local refs.

To test immediate NAS relink, use a phone photo that has already been backed up and indexed by the Photo API, then attach it from the phone and confirm it saves as `Linked to NAS archive` instead of waiting.

## Memory detail edit and delete test

1. Save a memory from Today with at least one attachment.
2. Open it from Timeline and confirm the detail route shows the date, prompt, text, tags, thumbnails, and sync labels.
3. Tap `Edit Memory`, change the date, prompt, text, and comma-separated tags, then save.
4. Re-open the same memory from Search and confirm those edits are reflected there too.
5. In edit mode, tap `Add Photos`, select more NAS photos, tap `Done`, and save.
6. Remove one attached photo reference, save again, and confirm the original NAS file still exists outside the app.
7. Tap `Delete Memory`, confirm the warning, and verify the app returns to Timeline with the memory gone.
8. Search for the deleted memory text and confirm it no longer appears.

## Pending NAS relink test

1. Attach a phone photo that has not been indexed by the NAS Photo API yet.
2. Save the memory and confirm it shows `Waiting for NAS backup`.
3. Let the phone finish backing up that photo to the NAS.
4. Run or wait for the Photo API scan so the image is indexed.
5. Reopen the app or tap `Retry NAS Photo Matching` in Settings.
6. Reopen the memory and confirm the status becomes `Linked to NAS archive`.
7. Confirm the memory still stores references only and no photo was uploaded to Supabase.

## Android reminder test

1. Open Settings and go to `Memory reminders`.
2. Tap `Allow Notifications` and grant Android permission.
3. Enable reminders, choose a cadence, time, and prompt style, then tap `Save Reminder Settings`.
4. Force close and reopen the app, then confirm the reminder settings still appear.
5. Tap `Test Notification` and confirm a local notification appears after about 5 seconds.
6. Tap the notification and confirm Tiny Chapters opens normally and lands on Today.
7. Pick a near-future reminder time, wait for the scheduled reminder, and confirm memory creation/edit/delete still work afterward.

Android notes:

- local notifications are most reliable in a development build or installed app, not Expo Go
- if permission is denied, Android system settings may need to be updated manually
- reminder settings are device-local and do not sync through Supabase yet

## Developer Mode

Tiny Chapters now includes a hidden Developer Mode for development-time troubleshooting.

How to enable it:

1. Open Settings.
2. Scroll near the bottom.
3. Tap the `App Version` row 7 times.
4. A new `Developer Mode` section will appear with `Open Diagnostics`.

Diagnostics currently cover:

- app environment details
- safe Supabase connection checks
- NAS Photo API `/health` and `/status`
- photo relink retry and durability counts
- notification status and test reminder actions
- recent diagnostics events

Secrets intentionally stay hidden:

- Supabase anon key
- NAS Photo API key
- bearer tokens
- passwords

This exists so we can troubleshoot the app before a later beta-readiness phase where full install-on-phone testing becomes the main focus.

Future reminder direction:

- AI-guided prompt coaching can be layered onto reminder copy later without changing the reminder storage model
