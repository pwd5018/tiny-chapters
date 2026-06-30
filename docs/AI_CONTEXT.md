# Tiny Chapters AI Context

Read this file, [ARCHITECTURE.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ARCHITECTURE.md), and [ROADMAP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ROADMAP.md) at the start of every session. Update all three after any completed phase or meaningful architecture, data model, or roadmap change.

## Project summary

Tiny Chapters is a private memory capsule and journal app for capturing small family moments. The mobile app stores auth, memory text, tags, and photo reference metadata in Supabase. Original photos stay outside Supabase. In the current personal workflow, a separate local Photo API indexes a Windows-accessible NAS share and serves metadata, thumbnails, and view URLs to the app.

## Current status after Phase 8

Implemented in the repo now:

- Expo Router mobile app with Today, Timeline, Search, and Settings flows
- Supabase Auth plus Supabase-backed `memories` and `memory_photo_refs`
- Service-layer boundaries for auth, memories, photos, reminders, diagnostics, and permissions
- Mock and NAS photo provider modes behind `photoService`
- Standalone `photo-api/` service with bearer auth, SQLite index, scan history, root checks, scheduled scans, thumbnails, and metadata matching
- NAS photo picker with By Date, Search, and Folders modes, paging, multi-select, preview, and native date picker
- Memory detail edit, delete, and attachment-management flows
- Local phone photo attachments saved as metadata-only refs with conservative NAS relink support
- App-start relink retry, memory-detail relink retry, and Settings manual retry
- Local reminder engine using `expo-notifications` and AsyncStorage
- Hidden Developer Mode and Diagnostics screen
- Installed Expo Development Build workflow with `expo-dev-client`
- Fixed-port Metro workflow on `8081` plus PowerShell `doctor`, `rebuild`, and `android:launch` tooling
- Developer-only startup environment banner and startup diagnostics
- Centralized permission helpers for notifications, camera, and photo-library access
- iOS readiness diagnostics for bundle id, permission status, Photo API URL, and NAS warning checks
- Phase 8 documentation for Development Setup and iOS readiness

Not implemented yet:

- Real iPhone validation, generated `ios/` project work, and TestFlight readiness
- Device photo library provider as a first-class source mode
- On This Day resurfacing
- Guided AI memory questions
- Export flows
- Product-mode cloud photo preservation

## Tech stack

- Mobile app: Expo, React Native, TypeScript, Expo Router
- Data/auth: Supabase Auth, Supabase Postgres, RLS
- Mobile persistence for auth/reminders/dev state: Expo SecureStore, AsyncStorage
- Notifications: `expo-notifications`
- Photo API: Node.js, TypeScript, Express, SQLite, `sharp`, `exifr`
- NAS access: Windows host filesystem access to UNC path or mapped drive

## Key commands

Mobile app:

```powershell
npm install
npm run dev
npm run rebuild
npm run android:launch
npm run doctor
npm run android
npm run android:device
npm run start:clear
npm run typecheck
```

Photo API:

```powershell
cd photo-api
npm install
npm run build
npm run dev
npm run start
npm run scan
npm run status
npm run typecheck
```

## Important environment variables

Mobile app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE`
- `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`
- `EXPO_PUBLIC_NAS_PHOTO_API_KEY`

Photo API:

- `PHOTO_LIBRARY_ROOT`
- `PHOTO_API_KEY`
- `PORT`
- `THUMBNAIL_CACHE_DIR`
- `DATABASE_PATH`
- `ENABLE_SCHEDULED_SCAN`
- `SCHEDULED_SCAN_TIME`
- `SCHEDULED_SCAN_TIMEZONE`

## Rules for future agents

- Read `docs/AI_CONTEXT.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` before making changes.
- Read `docs/DEVELOPMENT_SETUP.md` and `docs/IOS_READINESS.md` before changing native/dev-workflow or platform behavior.
- Keep the Metro port pinned to `8081` for dev-client workflows unless the repo docs and scripts are updated together.
- Update these docs after every completed phase or meaningful architecture/data-model/roadmap change.
- Document actual repo state, not intended state.
- Do not upload or copy photos to Supabase unless a later storage phase explicitly changes that decision.
- Preserve the provider/service abstraction. Screens should stay thin.
- Keep platform-aware permission and notification behavior in services or shared components rather than scattering new `Platform.OS` checks through screens.
- Keep NAS support optional and product-friendly rather than hard-wiring the whole app to a single home setup.
- Never expose secrets in UI, logs, screenshots, sample env files, or docs.
- Treat every `EXPO_PUBLIC_*` value as public once bundled into the app.
- Do not put Synology or NAS credentials in the mobile app.
- Do not scatter direct Supabase calls through screens or route files.
- Do not bypass `memoryService`, `photoService`, or `diagnosticsService` patterns without first updating architecture docs and service boundaries.
- Prefer UNC paths over mapped drives for Photo API deployment guidance.
- Be explicit about validation limits. Typecheck is not device/runtime verification.

## Known future directions

- Tailscale-based remote access to the Photo API
- Cross-platform readiness and iPhone validation
- Guided AI memory questions
- On This Day resurfacing
- Device photo provider
- Export formats
- Beta install/testing on real phones

## Current discrepancies to remember

- The older lowercase `docs/architecture.md` described parts of the Photo API and relink flow as future work. In the current repo, those pieces already exist and are documented as implemented in the uppercase docs.
- The installed Development Build is now the primary daily workflow. Expo Go is only for quick experiments and is not the source of truth for notifications or device-permission testing.
- The repo-level Android helper flow is now:
  `npm run doctor` for diagnostics,
  `npm run dev` for normal Metro work on `8081`,
  `npm run android:launch` to reconnect an installed build,
  and `npm run rebuild` when native changes require a new development client.
