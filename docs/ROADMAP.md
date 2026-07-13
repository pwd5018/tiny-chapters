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
  Completed.
  Tiny Chapters is gaining meaningful larger groupings for memories such as vacations, school years, holidays, and kid-specific chapters without undoing the calmer Today plus dedicated Write flow that now exists. This phase treats collections as durable archive structure rather than just leaning harder on free-form tags.
  Completed slices:
  1. Phase 16.1: Collection data foundation
     First-class collection storage and memory-to-collection membership now exist so one memory can belong to multiple larger chapters. The groundwork stays service-driven rather than screen-driven.
  2. Phase 16.2: Collection repository seam
     `memoryService` now includes collection CRUD, membership assignment, and collection-to-memory grouped queries so future screens can load archive structure without shaping Supabase data directly.
  3. Phase 16.3: Moments-first collection browsing
     Completed.
     Moments now surfaces collections as a richer archive entry point and allows drill-in to a collection detail view instead of asking Today to absorb more archive browsing.
  4. Phase 16.4: Lightweight assignment flows
     Completed.
     Tiny Chapters now lets users place memories into collections from the dedicated Write flow and the memory-detail screen without turning composition into a metadata-heavy checklist. Collection assignment stays optional at save time and stronger after save.
  5. Phase 16.5: Search and export integration
     Completed.
     Collections are now filterable in archive search and collection membership now flows through the export model and human-readable export formatting so later local/book workflows can preserve larger story structure instead of flattening everything back to tags alone.
  6. Phase 16.6: Manual-first starter templates
     Completed.
     The collection-assignment flow now includes manual-first starter templates for Vacation, School Year, Holiday, and Kid Chapter so users can start from a familiar chapter shape without needing AI suggestion or a separate management screen.
- Phase 17: Product Language and Domain Framing
  Completed.
  Tiny Chapters now frames itself as a broader personal life-memory platform in the canonical docs and main user-facing app copy, while intentionally keeping the current `memory` storage and service seams stable.
  Completed slices:
  1. Phase 17.1: Vision and terminology alignment
     Completed.
     Tiny Chapters now has an explicit life-memory vision that keeps family memories first-class without making them the only supported shape.
  2. Phase 17.2: Storage-language boundary
     Completed.
     The repo now documents and follows a practical boundary: keep `memory` for current implementation seams, and prefer broader chapter or entry language in product-facing surfaces.
  3. Phase 17.3: Future integration framing
     Completed.
     Tiny Chapters now documents its future provider role for trusted clients such as the Personal Assistant, including boundaries around durable truth, provenance, and authorization.
- Phase 18: Media Generalization
  Planned.
  Tiny Chapters should evolve from a photo-only attachment model into a broader media-reference model that can support video and later voice while preserving the existing NAS-first durable-reference architecture.
  Groundwork now in the repo:
  1. `memory_photo_refs` now carries additive media metadata such as `media_kind`, duration, mime type, and optional poster references without renaming the table.
  2. The shared device picker now accepts local video attachments alongside photos.
  3. Saved chapter surfaces now render video attachments more intentionally with media labels, duration cues, and non-photo fallback cards instead of assuming every attachment is a broken image.
  4. Export now preserves generalized media metadata for attached refs and summarizes media mix plus preview coverage while older photo-oriented seam names remain in place for compatibility.
  Still not complete:
  1. NAS indexing and matching are still photo-backed.
  2. Non-photo preview or poster generation is still minimal.
  3. Voice-note support is still future work.
  Planned slices:
  1. Phase 18.1: Media model and migration plan
     Generalize the current photo reference shape into a broader media-reference contract without breaking existing photo flows.
  2. Phase 18.2: Local video attachment support
     Allow attached local video references in the capture flow with metadata such as filename, duration, dimensions, and attachment state.
  3. Phase 18.3: Export and durability updates
     Preserve generalized media metadata in export and keep local-to-NAS durability behavior coherent.
- Phase 19: Metadata, Provenance, and Draft Lifecycle
  Planned.
  Tiny Chapters should distinguish user-authored truth from approved derived metadata, unconfirmed AI inference, and assistant-proposed drafts.
  Groundwork now in the repo:
  1. `memory_metadata` now exists as an additive sidecar seam for confirmed metadata and lifecycle state without changing the primary `memories` table.
  2. Write and chapter detail now support lightweight user-confirmed metadata capture for favorite status, importance, people, places, projects, topics, tags, and draft/finalized state.
  3. Search and export now understand that confirmed metadata and lifecycle state as first-class archive structure rather than only free text.
  4. Phase 19.2 now keeps AI-generated people, places, projects, topics, and tags in `memory_metadata_suggestions` until the user approves or dismisses each one. The gateway receives confirmed archive vocabulary first so it can reuse existing values before proposing a new one.
  Planned slices:
  1. confirmed metadata seams — completed as Phase 19.1
  2. inferred metadata suggestions — completed as Phase 19.2
  3. draft lifecycle for user-started and assistant-proposed entries
  4. retention and deletion-state expansion
- Phase 20: Retrieval and Search Foundation
  Planned.
  Expand the current archive retrieval model so Tiny Chapters can later support richer people/place/project/topic search and provider-ready context retrieval.
- Phase 21: Provider Boundary and Authorization
  Planned.
  Define Tiny Chapters as a secure life-memory provider with scoped permissions, retrieval logging, deep-link behavior, and revocation-ready consumer access.
- Phase 22: Personal Assistant Read-Only Integration
  Planned.
  Let the Personal Assistant search and read approved Tiny Chapters content through controlled contracts without duplicating full durable records.
- Phase 23: Personal Assistant Proposed Drafts
  Planned.
  Allow the Personal Assistant to submit proposed Tiny Chapters drafts that remain pending until approved inside Tiny Chapters.
- Phase 24: Year in Review
  Recap memories, top people/themes/places, and share/export flows.
- Phase 25: Product Mode and Cloud Options
  Support non-NAS users, optional cloud photo preservation, and explicit storage/privacy model decisions.
- Phase 26: Optional Home Agent
  Power-user NAS/private archive support with possible cloud relay later.
- Phase 27: Beta Readiness / Install-on-Phone Validation
  Broader beta-style validation after Android and first-pass iPhone dev-build workflows are stable: test permissions, notifications, NAS/Tailscale flows, offline/failure behavior, install polish, and performance.
- Side quest (un-numbered): Private Web Diary Companion
  Planned as a personal desktop/browser surface for diary entries only. Reuse the existing Supabase auth, memory service, search, collections, metadata, and writing seams where practical.
  Explicitly out of scope for the first web slice:
  - photo, video, and other media attachments
  - NAS Photo API browsing, relinking, and direct Photo API credentials in the browser
  - native reminders and mobile diagnostics
  - public multi-user product or separate cloud photo storage
  Suggested first slice:
  1. Browser-safe Supabase session persistence and web entrypoint.
  2. Today prompt, text-only diary writing, and save/edit/delete flows.
  3. Diary browsing/search plus lightweight collection and metadata support.
  4. Browser downloads for JSON/Markdown export.
  5. Basic private/local validation before deciding whether a hosted deployment is worthwhile.
- Phase 28: Polish and Release Prep
  Onboarding, app icon/splash, empty states, error messages, and later store readiness.

## How to use this roadmap

- Future Codex sessions should check `docs/ROADMAP.md` first when scoping work.
- Mark phases complete only after implementation and basic validation.
- If a phase expands, splits, or changes direction, update this file immediately rather than letting the roadmap drift.
- Partial groundwork inside a future phase does not count as phase completion by itself.
