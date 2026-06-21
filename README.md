# Tiny Chapters

Tiny Chapters is a private mobile memory capsule for saving small daily family moments. The app is Android-first, built with Expo Router and TypeScript, and is being structured so the storage layer can evolve without forcing major screen rewrites.

## Phase 2 status

Current state:
- Expo mobile shell with tab navigation
- Supabase-backed auth and memory persistence
- Mock photo provider for same-day photo references
- Today, Timeline, Search, and Settings screens working against service abstractions
- Native Android project available for emulator/device work when needed

Not implemented yet:
- Real NAS photo API
- AI cleanup
- Export flow

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
npm start
```

Run Android:

```powershell
npm run android
```

If Metro gets stuck on stale cache data:

```powershell
npx expo start -c
```

## Architecture summary

- `app/` contains Expo Router screens and navigation only
- `src/services/memoryService.tsx` exposes the memory repository interface used by screens
- `src/services/auth/` owns Supabase auth state and session persistence
- `src/services/photo/` contains the photo provider abstraction and a mock implementation
- `src/services/photo/photoService.ts` selects mock or NAS-backed photo access based on env config
- `src/lib/supabase.ts` initializes the Supabase client with Expo env vars and SecureStore-backed auth persistence
- `src/types/` defines domain models for memories and photos

The screens talk to services, and the services hide how data is actually stored. That keeps the UI steady when we later swap mock storage for Supabase or add a real NAS-backed photo index.

## Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL from [supabase/migrations/20260619_phase2_memories.sql](C:\Users\wolf-ai\Workspace\tiny-chapters\supabase\migrations\20260619_phase2_memories.sql).
3. In Supabase Authentication, enable Email provider.
4. Add your project URL and anon key to `.env`.
5. Restart Metro after adding env vars:

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

This keeps the NAS as the source of truth, avoids duplicate photo storage, and makes later re-indexing or export cleaner.

## Future NAS Photo API concept

The future photo layer is expected to look something like:

- `GET /photos?date=YYYY-MM-DD`
- `GET /photos/:photoId`

That API can return indexed NAS photo metadata, stable IDs, and optional content hashes while the app continues storing only references on each memory.

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
