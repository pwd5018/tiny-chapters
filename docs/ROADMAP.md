# Tiny Chapters Roadmap

Future Codex sessions should check this file first when planning work. Mark phases complete only after implementation plus basic validation. If scope changes, update this roadmap immediately.

## Completed

- Phase 1
  Initial Expo React Native app shell with TypeScript, Expo Router tabs, Today, Timeline, Search, Settings, and mock memory flow.
- Phase 1.5
  Service-layer refactor with `Memory`, `AttachedPhotoRef`, `PhotoProvider`, and mock photo provider abstractions.
- Phase 2
  Supabase auth and memory persistence with RLS-backed `memories` and `memory_photo_refs`.
- Phase 3
  NAS photo provider client plumbing and app configuration.
- Phase 3.5
  Standalone local `photo-api` service with Node + TypeScript, bearer auth, SQLite index, EXIF/date extraction, stable hash-based IDs, and thumbnail/view endpoints.
- Phase 3.6
  Operational hardening for the Photo API with `/status`, scan history, overlap protection, root reachability checks, safer logging, and CLI status.
- Phase 3.7
  Scheduled/background scan support and runtime reliability improvements for `photo-api`.
- Phase 3.8
  Captured photo durability model with local phone/camera attachments stored as metadata-only refs using `pending_nas_match`.
- Phase 3.9
  Immediate NAS relink attempt for local attachments using conservative metadata matching against the Photo API.
- Phase 4
  NAS photo picker UX with date-based photo selection, Photo API thumbnails, multi-select, and no Supabase photo storage.
- Phase 4.5
  Backend NAS search, real folder browsing, paging, and native date picker integration.
- Phase 5
  Memory detail, edit, delete, and attachment-management flows.
- Phase 5.5
  Pending NAS match relink flows through manual retry, app-start retry, and memory-detail retry.
- Phase 6
  Local notification settings and memory habit engine.
- Phase 6.5
  Hidden Developer Mode and Diagnostics screen.
- Phase 7
  Development Client and Daily Driver workflow with `expo-dev-client`, centralized environment config, developer startup diagnostics, and a documented Android-first real-device loop.
- Phase 8
  Cross-platform readiness and iOS preparation with centralized permission helpers, iOS app-config strings, platform-aware diagnostics, and an expanded future iPhone checklist without attempting full release work.
- Phase 9.1
  Today Experience Dashboard foundation with modular dashboard card types, async dashboard service plumbing, placeholder cards, and reusable card rendering on the Today screen.
- Phase 9.2
  Real On This Day memory resurfacing through `memoryService`, with same-calendar-date prior-year memories rendered inside the Today dashboard.
- Phase 9.3
  Guided Today dashboard cards with richer daily prompt guidance, real On This Day resurfacing, and the first IA cleanup pass with Today as a landing screen, a dedicated Write route, and Moments as the browsing/stats destination.

## Remaining milestones after Phase 10

- Phase 10: Guided AI Memory Questions
  Completed.
  Tiny Chapters now has a dedicated guided-writing flow in `write`, with preserved original answer state, up to 3 contextual follow-up questions, optional cleanup/polish, local fallback helpers, developer-mode AI source visibility, and the smallest safe Supabase persistence expansion for guided context.
  Completed slices:
  1. Guided-memory draft seam inside the dedicated Write flow, separating base question, original answer, future follow-up answers, and composed memory text.
  2. Supportive guided-writing UI inside `app/write.tsx` and `src/features/write/WriteMemoryScreen.tsx`, with skip-friendly follow-ups and no extra crowding on Today.
  3. Constrained AI follow-up generation plus optional cleanup or polish through the local `photo-api/` gateway, with graceful local fallback and provider secrets kept off the phone.
  4. Durable guided-memory persistence via `memories.guided_context`, preserving the guided context on saved memories without changing the core `memories.text` model.
- Phase 11: Device Photo Library Provider
  Completed.
  Tiny Chapters now supports product-friendly device photo selection alongside NAS browsing through the shared picker, preserves compatibility with NAS relink, and hardens saved-memory rendering around local-vs-NAS durability states.
  Completed slices:
  1. Phase 11.1: Provider and model foundation
     Extend the photo-source model beyond `mock | nas`, add a real device-library provider behind `photoService`, and separate active browsing source from NAS relink availability.
  2. Phase 11.2: Unified picker and Write integration
     Turn `photo-picker` into a broader source-aware picker, move phone-library selection onto the provider path, and keep the dedicated `write` route as the single composition flow.
  3. Phase 11.3: Durability, relink, and product polish
     Harden saved-memory rendering and device-photo attachment states, preserve compatibility with NAS relink, and prefer NAS-backed preview paths once relink succeeds.
- Phase 12: Tailscale Remote Access
  Completed.
  Tiny Chapters now supports remote Photo API access through Tailscale without opening router ports, keeps LAN vs Tailscale switching centralized through `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`, and preserves the existing provider/service architecture.
  Validation completed so far:
  1. Android phone access to the Photo API over Tailscale.
  2. Developer diagnostics labeling for `LAN`, `Tailscale`, `Localhost only`, and `Custom`.
  Validation still outstanding:
  1. Real iPhone Tailscale verification.
  2. Longer-session reconnect and failure-behavior validation.
- Phase 13: Export
  JSON, Markdown, readable archive format, and later PDF/book options.
- Phase 14: Search Upgrade
  Advanced filters, person/tag/date/location, and later semantic search.
- Phase 15: Memory Collections
  Vacations, school years, holidays, and kid-specific chapters.
- Phase 16: AI Cleanup and Enrichment
  Clean up text, generate titles, suggest tags, and never overwrite originals without explicit user confirmation.
- Phase 17: Year in Review
  Recap memories, top people/themes/places, and share/export flows.
- Phase 18: Product Mode and Cloud Options
  Support non-NAS users, optional cloud photo preservation, and explicit storage/privacy model decisions.
- Phase 19: Optional Home Agent
  Power-user NAS/private archive support with possible cloud relay later.
- Phase 20: Beta Readiness / Install-on-Phone Validation
  Broader beta-style validation after Android and first-pass iPhone dev-build workflows are stable: test permissions, notifications, NAS/Tailscale flows, offline/failure behavior, install polish, and performance.
- Phase 21: Polish and Release Prep
  Onboarding, app icon/splash, empty states, error messages, and later store readiness.

## How to use this roadmap

- Future Codex sessions should check `docs/ROADMAP.md` first when scoping work.
- Mark phases complete only after implementation and basic validation.
- If a phase expands, splits, or changes direction, update this file immediately rather than letting the roadmap drift.
- Partial groundwork inside a future phase does not count as phase completion by itself.
