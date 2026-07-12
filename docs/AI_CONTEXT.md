# Tiny Chapters AI Context

Read this file, [ARCHITECTURE.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ARCHITECTURE.md), and [ROADMAP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ROADMAP.md) at the start of every session. Update all three after any completed phase or meaningful architecture, data model, or roadmap change.

## Project summary

Tiny Chapters is a private memory capsule and journal app for capturing small family moments. The mobile app stores auth, memory text, tags, and photo reference metadata in Supabase. Original photos stay outside Supabase. In the current personal workflow, a separate local Photo API indexes a Windows-accessible NAS share and serves metadata, thumbnails, and view URLs to the app.

## Current status after Phase 15

Implemented in the repo now:

- Expo Router mobile app with a lighter Today dashboard, dedicated `write` composition route, Moments browsing/stats tab, Search, and Settings flows
- Today screen dashboard foundation with modular card types, async card service plumbing, reusable dashboard rendering, real On This Day resurfacing, and richer daily prompt guidance
- Today can now also surface one random older memory from outside the current day on load, with an in-place button to reveal another one without leaving the lighter dashboard flow
- The opening question is now service-backed instead of a fixed rotation, can use the local AI gateway when configured, and reuses an unused prompt for a date until a save actually consumes it
- Same-day capture now feels more intentional: after a save on the same date, Tiny Chapters can offer a fresh opening angle and explain that a second or third memory can be a different scene or detail from the day
- Redesigned UI baseline with a slimmed Today header, calmer dashboard hierarchy, shared hero treatment across main screens, and warmer editorial card/form styling
- Guided-memory write-state that preserves the base daily question, original answer, follow-up slots, and composed memory text as separate draft concepts inside the dedicated Write flow
- AI-capable write flow inside the dedicated Write route, using the local gateway in `photo-api/` when configured and falling back gracefully to deterministic local helpers when it is not
- Optional cleanup seam inside the dedicated Write route that keeps a separate polished short-form suggestion instead of overwriting the rough draft by default
- Saved memories can now persist guided context in Supabase through `memories.guided_context`, while still keeping the main saved memory in `memories.text`
- Completed Phase 13 export foundation with a canonical archive schema, photo-manifest mapping, export summary counts, and service-layer filtering helpers
- Settings-based archive export actions for JSON and Markdown, oriented around a remembered Android export folder so files land somewhere the user can actually browse
- First-pass targeted export controls in Settings, including date-range filters, comma-separated tag filters, and a preview summary before export
- Book-builder-ready export metadata, including date-span and tag summaries, per-memory print-readiness signals, and explicit pending/missing photo review lists for later local companion tooling
- Completed Phase 14 search upgrade with stronger archive filtering across text, exact tags, date range, guided-memory presence, photo presence, and photo durability states
- Supabase Auth plus Supabase-backed `memories` and `memory_photo_refs`
- Service-layer boundaries for auth, memories, photos, reminders, diagnostics, and permissions
- Mock, NAS, and device-aware photo source handling behind `photoService`
- Standalone `photo-api/` service with bearer auth, SQLite index, scan history, root checks, scheduled scans, thumbnails, and metadata matching
- Shared photo picker with `Device | NAS` source tabs, native phone-library selection, and NAS By Date / Search / Folders browsing
- Memory detail edit, delete, and attachment-management flows
- Local phone photo attachments saved as metadata-only refs with conservative NAS relink support
- App-start relink retry, memory-detail relink retry, and Settings manual retry
- Saved-memory attachment states now distinguish device-only, pending NAS match, and NAS-linked behavior more clearly, and NAS-linked refs now prefer archive-backed preview paths instead of stale temporary device URIs
- Local reminder engine using `expo-notifications` and AsyncStorage
- Hidden Developer Mode and Diagnostics screen
- Installed Expo Development Build workflow with `expo-dev-client`
- Fixed-port Metro workflow on `8081` plus PowerShell `doctor`, `rebuild`, and `android:launch` tooling
- `EXPO_DEV_SERVER_HOST` can now be pinned in the repo-root `.env` for persistent Metro host selection, including Tailscale dev-client launches
- Developer-only startup environment banner and startup diagnostics
- Developer Mode now shows the active Metro dev-server URL and classifies it as `LAN`, `Tailscale`, `Localhost only`, or `Custom`, alongside the existing Photo API path diagnostics
- Centralized permission helpers for notifications, camera, and photo-library access
- iOS readiness diagnostics for bundle id, permission status, Photo API URL, and NAS warning checks
- Tailscale-aware Photo API diagnostics and centralized LAN vs Tailscale URL switching through `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`
- Phase 8 documentation for Development Setup and iOS readiness

Not implemented yet:

- Real iPhone validation, generated `ios/` project work, and TestFlight readiness
- AI-generated Today follow-up questions
- Dashboard photo thumbnails inside On This Day cards
- NAS or device-photo dashboard suggestions
- Advanced stats expansions beyond the current totals, monthly count, and streak summary that live on the Moments tab
- A local companion workflow that resolves actual photo files for a printed book from the richer Phase 13 export manifest
- Explicit person and location entities for structured search
- Semantic search
- Product-mode cloud photo preservation

Current next-phase plan:

- Phase 13 is complete.
- Phase 14 is complete.
- Phase 15 is complete.
- Export is now the archive-ready handoff format for a later printed-book workflow, not just a one-off data dump.
- The current export preserves enough photo identity and readiness metadata for a later local companion workflow to resolve real originals from NAS or local storage and triage what still needs attention.
- The next app-roadmap phase is Phase 16: Memory Collections.
- Phase 16 should add meaningful larger groupings for memories such as vacations, school years, holidays, and kid-specific chapters without undoing the calmer Today plus dedicated Write flow that now exists.
- Phase 16 should treat collections as durable archive structure, not just a thin tag preset layer.
- The first planned slices are:
  1. collection data foundation
  2. collection repository/service seam
  3. Moments-first collection browsing
  4. lightweight collection assignment flows
  5. search/export integration
  6. manual-first starter templates
- The next print-focused step should live in a separate local companion workflow that reads the Tiny Chapters export, resolves actual photo files, and assembles print-ready output.

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
- Keep the Today dashboard modular. Add new Today experiences as typed dashboard cards and service-backed card generation rather than hardcoding more one-off sections into `app/(tabs)/index.tsx`.
- Keep memory resurfacing logic inside `memoryService` and card composition inside `src/features/dashboard/` rather than reintroducing direct data shaping in routes.
- Keep the dedicated `write` route focused on composition. Resist pulling the full editor and photo browser back into Today unless the overall IA changes intentionally.
- Keep collection browsing anchored in Moments and collection/service seams rather than reintroducing archive-density on Today.
- Keep collection assignment lightweight in Write. Prefer optional save-time assignment plus memory-detail editing over turning the write flow into a metadata checklist.
- Keep guided-memory question state in the dedicated Write flow. Do not spread multi-step guided writing across Today, Moments, or Settings.
- Treat the current redesign as the visual baseline for future milestone work. Extend the calmer Today, stronger Moments ownership, and single writing path instead of reintroducing duplicate actions or crowded home-screen sections.
- Never expose secrets in UI, logs, screenshots, sample env files, or docs.
- Treat every `EXPO_PUBLIC_*` value as public once bundled into the app.
- Do not put Synology or NAS credentials in the mobile app.
- Do not scatter direct Supabase calls through screens or route files.
- Do not bypass `memoryService`, `photoService`, or `diagnosticsService` patterns without first updating architecture docs and service boundaries.
- Prefer UNC paths over mapped drives for Photo API deployment guidance.
- Be explicit about validation limits. Typecheck is not device/runtime verification.

## Known future directions

- Cross-platform readiness and iPhone validation
- Guided AI memory questions
- Export formats and future book-builder workflow
- Beta install/testing on real phones

## Current discrepancies to remember

- The older lowercase `docs/architecture.md` described parts of the Photo API and relink flow as future work. In the current repo, those pieces already exist and are documented as implemented in the uppercase docs.
- The installed Development Build is now the primary daily workflow. Expo Go is only for quick experiments and is not the source of truth for notifications or device-permission testing.
- The repo-level Android helper flow is now:
  `npm run doctor` for diagnostics,
  `npm run dev` for normal Metro work on `8081`,
  `npm run android:launch` to reconnect an installed build,
  and `npm run rebuild` when native changes require a new development client.
