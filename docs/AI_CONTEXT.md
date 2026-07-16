# Tiny Chapters AI Context

Read this file, [ARCHITECTURE.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ARCHITECTURE.md), and [ROADMAP.md](C:\Users\wolf-ai\Workspace\tiny-chapters\docs\ROADMAP.md) at the start of every session. Update all three after any completed phase or meaningful architecture, data model, or roadmap change.

## Project summary

Tiny Chapters is a private life-memory app for capturing durable personal records across family memories, diary-style entries, reflections, ideas, life events, and other meaningful chapters of lived experience. The current implementation still uses `memory` as the core storage and service term, but the product direction is broader than family-only capture now. The mobile app stores auth, memory text, tags, guided context, collection membership, and photo reference metadata in Supabase. Original photos stay outside Supabase. In the current personal workflow, a separate local Photo API indexes a Windows-accessible NAS share and serves metadata, thumbnails, and view URLs to the app.

## Current status after Phase 19

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
- Phase 18 groundwork inside the existing `memory_photo_refs` seam: additive media metadata columns now exist for `media_kind`, duration, mime type, and optional poster references without renaming the table or breaking photo rows
- Local device-library video attachments are now accepted through the shared picker and stored as generalized attachment refs, while existing NAS-backed photo flows continue unchanged
- Export now preserves generalized media metadata for attached refs even though some implementation seams still keep legacy photo-oriented names for compatibility
- Saved chapter surfaces now render video attachments with media-aware fallback treatment and duration cues instead of assuming every attachment needs an image thumbnail
- Completed Phase 14 search upgrade with stronger archive filtering across text, exact tags, date range, guided-memory presence, photo presence, and photo durability states
- Supabase Auth plus Supabase-backed `memories`, `memory_metadata`, and `memory_photo_refs`
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
- Search UI for canonical entity filters and alias management
- Semantic search
- Product-mode cloud photo preservation

Current next-phase plan:

- Phases 13 through 17 are complete.
- Phase 18 has partial groundwork in the repo: local video refs and generalized attachment metadata exist, but NAS indexing, poster generation, richer previews, and voice-note support are still unfinished.
- Phase 19 is complete: `memory_metadata` holds confirmed user-controlled metadata, while `memory_metadata_suggestions` holds AI proposals until individually approved or dismissed. Metadata inference uses chapter text only, requires exact evidence, prefers existing confirmed archive values, and may return no suggestion.
- AI polish is optional and suggestion-only. It receives each answered follow-up alongside its question so it preserves distinct participants, observers, and reactions; ambiguous fragments are omitted. The local fallback returns only the clear original answer.
- A separate user draft-save workflow is intentionally deferred: the existing Write/detail editing flow meets the current need. Assistant-proposed drafts remain deferred to Phase 23, after provider authorization.
- Phase 20 is complete: retrieval now has canonical vocabulary, alias-aware matching, deterministic ranking, pagination, explicit Any/All entity-filter semantics, and a stable context projection for future provider use. The next implementation priority is Phase 21: Provider Boundary and Authorization.
- Phase 20.1 is complete: `memory_entities`, `memory_entity_aliases`, and `memory_entity_memberships` provide an additive canonical vocabulary seam. Confirmed Phase 19 tags and metadata are backfilled and create/update/approved-suggestion flows keep the membership index synchronized. Search exposes grouped canonical filters, resolves exact canonical names or aliases into retrieval matches, receives explicit match evidence, batches entity indexing, debounces text search, and loads reference data separately from results. Zero-count entities are retained in storage but hidden from filter suggestions.
- Phase 21 is in progress: `memory_provider_grants` and `memory_provider_access_logs` now provide the owner-scoped authorization and audit foundation, with a versioned `tiny-chapters.memory-retrieval` contract and an initial `memories:read` scope. The external provider adapter, retrieval enforcement, deep-link validation, and revocation runtime behavior remain to be implemented.
- The next print-focused step should still live in a separate local companion workflow that reads the Tiny Chapters export, resolves actual photo files, and assembles print-ready output.
- A separate un-numbered side quest is parked for later: a private, diary-only browser companion. It should reuse the existing Supabase and memory-service seams, exclude all media/NAS/native-reminder behavior, and not be treated as current implementation work.

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
- Keep the current `memory` implementation seams stable until a later migration clearly justifies a rename to `chapter` or a broader domain term.
- Treat Tiny Chapters as the future provider of durable life records and the Personal Assistant as a future consumer. Do not design future integrations around direct database-table access from another app.
- Preserve the distinction between user-authored truth, approved derived metadata, unconfirmed AI inference, and temporary machine-generated context.
- Do not let future assistant or AI integrations silently promote temporary context or inferred metadata into durable Tiny Chapters truth without explicit user approval.
- Plan future media support as a generalized attachment model that can expand from photos to video and later voice while keeping original binaries outside Supabase.
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
