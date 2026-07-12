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
  Completed.
  Tiny Chapters now supports save-first archive export through Settings with shared JSON and Markdown outputs, targeted date/tag filtering, a user-chosen Android export folder, and a book-builder-ready manifest that calls out print readiness and photo attention areas without bundling original binaries.
  Completed slices:
  1. Phase 13.1: Export foundation
     Define the canonical archive export schema plus service-layer filtering and mapping helpers. Preserve stable photo-manifest identity such as `photoId`, `path`, `filename`, `contentHash`, `takenAt`, `source`, and `syncStatus` so later workflows can reconnect to originals.
  2. Phase 13.2: JSON and Markdown outputs
     Generate machine-friendly JSON plus human-readable Markdown from the same canonical export model. Keep this honest about photo durability and reference-only storage.
  3. Phase 13.3: Targeted export controls
     Add first-pass export targeting through Settings with date range, lightweight tag filtering, preview summaries, and save-first export handling instead of hiding files in app-private storage.
  4. Phase 13.4: Book-builder-ready manifest polish
     Extend the canonical export with date-range, tag, and print-readiness summaries plus explicit pending/missing photo review lists so a later local companion workflow can identify safe book candidates and unresolved photo work quickly.
  Not in Phase 13:
  - cloud photo sync
  - original photo bundling inside the mobile app
  - full PDF/book generation or print-service integration
- Phase 14: Search Upgrade
  Completed.
  Tiny Chapters Search now supports richer archive filtering across free-text search, exact tag filters, date range, guided-memory presence, photo presence, and attached-photo durability states while keeping the route focused on the existing memory model instead of inventing unsupported structure.
  Completed slices:
  1. Phase 14.1: Structured search service filters
     Extend the memory-service search seam beyond a single query string so routes can filter by current repo-backed metadata such as date range, tags, guided context, and attached photo sync states.
  2. Phase 14.2: Search screen filter UX
     Upgrade the Search tab with a clearer filter surface and active-summary behavior without turning it into a dense admin screen.
  Follow-on search work still outside Phase 14:
  - explicit person entities
  - explicit location entities
  - semantic search
- Phase 15: AI Prompting and Resurfacing
  Completed.
  Tiny Chapters now supports a service-backed opening-question seam that can use the local AI gateway when configured, reuses an unused prompt instead of regenerating it on every reload, varies the opening angle after same-day saves, and adds a lightweight Today resurfacing card that can show another older memory in place without turning Moments into a second home screen.
  Completed slices:
  1. Phase 15.1: Intelligent opening-question seam
     Replace the fixed daily-question rotation with a service-backed prompt seam that can use AI when configured, fall back locally when it is not, and stay aware of same-day saved prompts so later memories on the same date get a fresh starting angle.
  2. Phase 15.2: Write-flow integration and prompt persistence
     Keep the dedicated Write flow as the owner of the fuller guided-writing experience while preserving the actual opening prompt used for each saved memory and making repeated same-day capture feel intentional instead of repetitive.
  3. Phase 15.3: Random memory resurfacing on Today
     Add a calm Today dashboard card that shows one older memory on load and can fetch another random resurfaced memory from a configurable timeframe without crowding Moments or turning Today into a dense archive browser.
- Phase 16: Memory Collections
  Planned.
  Tiny Chapters should gain meaningful larger groupings for memories such as vacations, school years, holidays, and kid-specific chapters without undoing the calmer Today plus dedicated Write flow that now exists. This phase should treat collections as durable archive structure rather than just leaning harder on free-form tags.
  Planned slices:
  1. Phase 16.1: Collection data foundation
     Add first-class collection storage and memory-to-collection membership so one memory can belong to multiple larger chapters. Preserve the existing memory model and keep this groundwork service-driven rather than screen-driven.
  2. Phase 16.2: Collection repository seam
     Extend `memoryService` with collection CRUD, membership assignment, and grouped queries so screens can load archive structure without shaping Supabase data directly.
  3. Phase 16.3: Moments-first collection browsing
     Upgrade the Moments experience to surface collections as a richer archive entry point, then allow drill-in to a collection detail view instead of asking Today to absorb more archive browsing.
  4. Phase 16.4: Lightweight assignment flows
     Let users place memories into collections without turning Write into a metadata form. Prefer optional assignment at save time plus stronger edit/detail assignment tools over a heavy compose flow.
  5. Phase 16.5: Search and export integration
     Make collections filterable in archive search and include collection membership in exports so later local/book workflows can preserve the larger story structure.
  6. Phase 16.6: Manual-first starter templates
     Start with manual collections plus helpful templates or presets such as Vacation, School Year, Holiday, and Kid Chapter. AI suggestion or auto-classification work belongs later, not in the first collection pass.
- Phase 17: AI Cleanup and Enrichment
  Clean up text, generate titles, suggest tags, and never overwrite originals without explicit user confirmation.
- Phase 18: Year in Review
  Recap memories, top people/themes/places, and share/export flows.
- Phase 19: Product Mode and Cloud Options
  Support non-NAS users, optional cloud photo preservation, and explicit storage/privacy model decisions.
- Phase 20: Optional Home Agent
  Power-user NAS/private archive support with possible cloud relay later.
- Phase 21: Beta Readiness / Install-on-Phone Validation
  Broader beta-style validation after Android and first-pass iPhone dev-build workflows are stable: test permissions, notifications, NAS/Tailscale flows, offline/failure behavior, install polish, and performance.
- Phase 22: Polish and Release Prep
  Onboarding, app icon/splash, empty states, error messages, and later store readiness.

## How to use this roadmap

- Future Codex sessions should check `docs/ROADMAP.md` first when scoping work.
- Mark phases complete only after implementation and basic validation.
- If a phase expands, splits, or changes direction, update this file immediately rather than letting the roadmap drift.
- Partial groundwork inside a future phase does not count as phase completion by itself.
