# Tiny Chapters Life-Memory Vision and Integration Plan

This document translates the current Tiny Chapters repository into the next product direction without claiming that the implementation has already changed. It is a planning document, not an implementation-complete architecture description.

## Purpose

Tiny Chapters is evolving from a family-memory app into a broader personal life-memory platform.

It should still feel simple and personal:

- family memories remain first-class
- diary entries fit naturally
- reflections, ideas, project thoughts, work experiences, travel memories, funny conversations, lessons learned, difficult periods, and accomplishments also fit naturally
- photos, video, and voice should be optional media attached to the same durable record model

Tiny Chapters should become the user's durable, intentional system of record for personal life history.

## What Tiny Chapters should become

- A private, durable home for intentional life records.
- A standalone product with its own storage, permissions, retention rules, and editing surface.
- A future life-memory provider that trusted clients can search and read through explicit contracts.
- The authoritative owner of durable truth about user-authored life entries and approved derived metadata.

## What Tiny Chapters should not become

- Not a catch-all assistant state store.
- Not a cache for external lookups, temporary research, or operational working memory.
- Not a direct-table backend that other apps read without service boundaries.
- Not a system that silently upgrades AI guesses into user truth.

## Relationship to the Personal Assistant

The future model should stay provider-and-consumer based:

- Tiny Chapters is the life-memory provider.
- The Personal Assistant is an authorized consumer.
- Tiny Chapters exposes controlled application services or APIs later.
- The assistant must not access Tiny Chapters tables directly.
- The assistant should reference Tiny Chapters records rather than duplicating full durable records into assistant memory.

Tiny Chapters owns:

- durable life records
- approved derived metadata
- user-authored edits
- deletion and retention behavior
- deep links back into original records

The Personal Assistant owns:

- conversational memory
- temporary working context
- summaries for active conversations
- cached external lookups
- operational assistant state

Temporary assistant memory must never be treated as equivalent to durable Tiny Chapters truth unless the user explicitly promotes it into a Tiny Chapters draft or saved record.

## Current repo reality

The current codebase is still built around the `memory` concept:

- `Memory` and `AttachedPhotoRef` in `src/types/memory.ts`
- `memoryService` in `src/services/memoryService.tsx`
- `memories`, `memory_photo_refs`, `memory_collections`, and `memory_collection_memberships` in Supabase migrations

That is acceptable for now. The product can broaden before the storage layer is renamed.

Recommendation:

- broaden product language first
- keep storage and service names stable until a later migration is clearly worth the churn
- introduce richer side tables and contracts before considering a physical rename from `memories` to `chapters`

## Recommended primary record model

Tiny Chapters should continue to center on one flexible primary record instead of forcing a category before save.

Suggested product language:

- `Chapter`
- `Life Entry`

Suggested implementation strategy for now:

- keep `memory` as the current storage and service term
- introduce `chapter` as product and integration language

### Language by layer

Recommended wording by layer:

- storage and implementation
  - keep `memory`, `memories`, `memoryService`, and existing table names until a later migration is worth the churn
- product-facing capture and browsing copy
  - prefer `chapter`, `entry`, `saved chapter`, or `archive` depending on the surface
- integration and external contracts
  - prefer `chapter` as the primary provider term
- documentation that describes current code
  - be explicit when the current repo still uses `memory` as the implementation term

Practical rule:

- if the text is describing the current code, schema, or service seams, use `memory`
- if the text is speaking to the user or describing the future product model, prefer broader terms such as `chapter` or `entry`

Each chapter should allow:

- one sentence
- several paragraphs
- a diary entry
- a family memory
- a project thought
- a reflection
- a life event
- attached photos
- attached video
- attached voice notes

The user should not need to classify it before saving.

## Target domain model

Keep one durable primary record, then add sidecar entities around it.

Core entities to add over time:

- primary record
  - current implementation base: `memories`
  - future product language: `chapters`
- media references
  - photos now
  - later video and voice references
- collections
  - existing larger groupings such as vacations, holidays, school years, kid chapters
- confirmed metadata
  - people, places, projects, topics, dates, importance, favorites
- inferred metadata
  - AI summaries, topics, mood, semantic links, captions, confidence-scored inferences
- relationships
  - related chapters, same event, same person, same project, follow-up, sequel
- drafts
  - especially assistant-proposed chapters awaiting approval
- embeddings
  - versioned semantic retrieval data separate from user-authored truth
- access and retrieval logs
  - consumer identity, scope, timestamp, reason, provider destination

### Trust and provenance model

Every durable record or metadata item should carry provenance and trust state.

Recommended categories:

- `primary`
  - user-authored records
  - user-selected labels
  - user-chosen media references
- `derived_confirmed`
  - AI or assistant suggestions explicitly approved by the user
- `derived_unconfirmed`
  - machine-generated metadata not yet approved
- `temporary`
  - should usually stay outside Tiny Chapters

AI-generated material must never silently overwrite user-authored truth.

## Media direction, including video

The current repo is explicitly photo-shaped. It should evolve into a broader media-reference model.

Recommendations:

- preserve the current NAS-first principle for original binaries
- keep storing durable references and metadata rather than uploading original media to Supabase
- support zero, one, or many media attachments per chapter
- add video support as part of a broader media-generalization phase rather than bolting it awkwardly onto photo-only types
- treat voice notes the same way later: referenced media with metadata, provenance, and attachment state

Near-term recommendation for video:

- allow attached local video references
- extend media metadata to include duration, mime type, preview/poster fields, and optional dimensions
- keep relink and durability behavior consistent with the existing local-to-NAS philosophy

## Integration boundary

Tiny Chapters should later expose a versioned provider contract.

Target consumer actions:

- search chapters
- retrieve a chapter by id
- retrieve related chapters
- search by person, place, project, topic, and date range
- retrieve timeline entries or summaries
- request constrained context for a user question
- create a proposed draft
- request approval for preserving conversation content
- open deep links back into Tiny Chapters

Consumer restrictions:

- no direct table access
- no delete rights
- no silent rewrite of user-authored history
- no permanent mutation of AI metadata without approval
- no unrestricted copying of full chapter content into assistant memory

## Suggested API direction

Do not implement yet, but design toward a versioned contract such as:

- `GET /v1/life-memory/chapters/search`
- `GET /v1/life-memory/chapters/:id`
- `GET /v1/life-memory/chapters/:id/related`
- `POST /v1/life-memory/context`
- `POST /v1/life-memory/drafts`
- `POST /v1/life-memory/drafts/:id/approve`
- `GET /v1/life-memory/permissions`

Default retrieval should prefer summaries and excerpts over full bodies unless a scope explicitly allows full content.

## Identity, ownership, and permissions

The current repo is single-user and Supabase-auth-based. Future expansion should still design for stronger boundaries.

Recommendations:

- keep records user-scoped
- add application scopes for future consumers
- support revocable assistant access
- support private versus shared records later without forcing family-sharing work now
- allow sensitive entries to block AI retrieval entirely
- log retrieval access and downstream provider use

## Privacy and AI boundaries

Tiny Chapters should be able to control what data can be sent to which provider.

Design goals:

- per-provider consent
- minimum necessary retrieval
- redaction before provider calls when appropriate
- user-visible source attribution
- sensitive-entry flags
- excluded-from-ai flags
- retrieval audit logs
- retention controls for derived metadata

A diary entry should not automatically become available to every model simply because an integration exists.

## Migration strategy

Use additive migrations first.

Recommended sequence:

1. Update product language and docs.
2. Add provenance, lifecycle, and source metadata to the current memory model.
3. Add side tables for confirmed metadata, inferred metadata, relationships, drafts, embeddings, and access logs.
4. Generalize photo references into media references.
5. Improve retrieval/search around the richer model.
6. Add provider-facing read-only contracts.
7. Add assistant-proposed drafts after read-only access and audit logging are stable.

Avoid an early destructive rename of `memories` unless the product language has stabilized and the migration cost is justified.

## Recommended next phases

### Phase 17: Product Language and Domain Framing

Objective:

- align Tiny Chapters docs, UX copy, and planning language around the broader life-memory vision without forcing a risky storage rename

Scope:

- update canonical docs
- update stale README language
- identify where product copy should shift from narrow family-memory wording to broader life-memory wording
- keep storage and service seams stable for now

### Phase 18: Media Generalization

Objective:

- evolve the current photo-only attachment model into a broader media-reference model

Scope:

- plan and implement support for photos, video, and later voice
- preserve NAS-first durable-reference behavior
- extend export and durability metadata accordingly

### Phase 19: Chapter Metadata, Provenance, and Drafts

Objective:

- separate user truth from inferred metadata and add explicit draft lifecycle support

Scope:

- confirmed metadata
- inferred metadata
- provenance fields
- lifecycle status
- assistant-proposed draft model

### Phase 20: Retrieval and Search Foundation

Objective:

- move from purely app-side memory filtering toward provider-ready retrieval seams

Scope:

- richer filters
- relationship reads
- chapter summaries
- context retrieval shaping

### Phase 21: Provider Boundary and Authorization

Objective:

- define Tiny Chapters as a secure life-memory provider for trusted clients

Scope:

- versioned contract
- scopes
- access logging
- deep-link format
- revocation behavior

### Phase 22: Personal Assistant Read-Only Integration

Objective:

- let the assistant search and reference Tiny Chapters records without owning them

### Phase 23: Personal Assistant Proposed Drafts

Objective:

- let the assistant submit draft candidates that remain pending until user approval inside Tiny Chapters

## What to work on first

Work on Phase 17 first.

Reason:

- the repo still uses `memory` everywhere, and that is fine
- the product direction needs to be made explicit before adding schema churn
- video support, richer metadata, and assistant integration will be cleaner once the product model and domain boundaries are documented consistently

The first implementation slice after this planning pass should be:

- product copy and terminology updates in the app where needed
- a stable decision on `memory` versus `chapter` language by layer
- scoping the media-generalization work so video fits the existing architecture instead of becoming a one-off exception
