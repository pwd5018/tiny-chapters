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

## Remaining milestones after Phase 8

- Phase 9: On This Day memories
  Same calendar date in prior years, memory resurfacing, and NAS thumbnails when reachable.
- Phase 10: Guided AI Memory Questions
  Daily base question, user answer, 1-3 contextual follow-up questions, preserve original answer, and avoid turning AI into an interrogation goblin.
- Phase 11: Device Photo Library Provider
  Product-friendly photo source, local device refs, and compatibility with NAS relink and preservation strategy.
- Phase 12: Tailscale Remote Access
  Reach the Photo API away from home through Tailscale, support LAN vs Tailscale base URL config, and avoid open router ports.
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
