# Tiny Chapters Architecture

## Overview

Tiny Chapters is being structured so the UI can stay stable while the underlying storage changes over time.

## Mobile App

- React Native / Expo
- Screens call services
- Services hide storage implementation
- Root auth gate decides whether to show the signed-in app or the email auth flow

The `app/` routes should not need to know whether memories come from mock state, Supabase, or another source later.

## Memory Storage

- Supabase now
- Repository abstraction remains in place for future changes

Current memory operations are exposed through a repository-style service:

- `getMemories()`
- `getMemoryById(id)`
- `createMemory(input)`
- `searchMemories(query)`

That lets the app migrate from in-memory data to Supabase without changing the screen contracts much.

The repository is also where:
- Supabase rows are mapped to app-level `Memory` objects
- `attachedPhotos` are stitched in from `memory_photo_refs`
- future export and cleanup logic can stay isolated from the screens

## Auth

- Email/password sign up and sign in through Supabase Auth
- Session persistence via Expo SecureStore
- Screens do not talk to Supabase Auth directly

`src/services/auth/authService.ts` exposes the auth operations, while `src/services/auth/AuthProvider.tsx` keeps session state available to the app shell.

## Photo Storage

- NAS remains source of truth
- App stores only photo references
- Future NAS Photo API will index photos by stable IDs/content hashes

Memories now store `attachedPhotos` as lightweight references instead of copied image assets. This prepares the app for a model where photo metadata is searchable while the actual file stays on the NAS.

The mobile app now has two client-side photo source modes:

- `mock`
- `nas`

`src/services/photo/photoService.ts` chooses the active provider using Expo public env vars, while the screens stay provider-agnostic.

## Future NAS Photo API

- `GET /photos?date=YYYY-MM-DD`
- `GET /photos/:photoId`

The future photo API should return indexed metadata such as:

- stable `photoId`
- path
- taken date
- thumbnail/view URLs
- content hash when available

The contract details live in:

- [docs/nas-photo-api.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\nas-photo-api.md)

## Current Flow

1. Today screen asks the photo provider for photos on the current date.
2. The user selects any photos they want attached to the memory.
3. The memory repository stores attached photo references alongside the written memory.
4. Timeline and Search read memories through the repository layer.
5. Settings reads auth/session state from the auth service layer.

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

It also:

- creates an `auth.users` trigger that auto-inserts a matching `profiles` row
- backfills `profiles` for any already-existing auth users
