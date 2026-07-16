export type AttachedPhotoSource = "nas" | "local" | "mock";
export type AttachedMediaKind = "photo" | "video" | "voice";
export type MemoryLifecycleStatus = "draft" | "finalized";
export type MemoryImportance = 1 | 2 | 3;
export type MemoryMetadataSuggestionField = "tag" | "person" | "place" | "project" | "topic";
export type MemoryMetadataSuggestionStatus = "pending" | "approved" | "rejected";
export type MemoryEntityKind = MemoryMetadataSuggestionField;
export type AttachedPhotoSyncStatus =
  | "local_only"
  | "pending_nas_match"
  | "linked_to_nas"
  | "missing"
  | "preserved_copy";
export type MemoryCollectionKind =
  | "vacation"
  | "school_year"
  | "holiday"
  | "kid_chapter"
  | "custom";

export type GuidedMemoryFollowUpStatus = "pending" | "answered" | "skipped";

export type GuidedMemoryFollowUp = {
  id: string;
  question: string;
  answer: string;
  order: number;
  status: GuidedMemoryFollowUpStatus;
};

export type GuidedMemoryDraft = {
  baseQuestion: string;
  originalAnswer: string;
  followUps: GuidedMemoryFollowUp[];
  composedText: string;
  polishedSuggestion: string | null;
};

export type MemoryGuidanceContext = {
  baseQuestion: string;
  originalAnswer: string;
  followUps: GuidedMemoryFollowUp[];
  polishedSuggestion: string | null;
};

export type MemoryMetadata = {
  lifecycleStatus: MemoryLifecycleStatus;
  isFavorite: boolean;
  importance: MemoryImportance | null;
  people: string[];
  places: string[];
  projects: string[];
  topics: string[];
};

export type MemoryEntity = {
  id: string;
  kind: MemoryEntityKind;
  canonicalName: string;
  aliases: string[];
  memoryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryRetrievalMatch = {
  type: "text" | "canonical_entity" | "alias" | "entity_filter";
  label: string;
  entityId?: string;
  entityKind?: MemoryEntityKind;
  canonicalName?: string;
  alias?: string;
};

export type MemoryRetrievalContext = {
  source: "tiny_chapters_archive";
  memoryId: string;
  deepLink: string;
  lifecycleStatus: MemoryLifecycleStatus;
  trustLevel: "user_authored_finalized" | "user_authored_draft";
  matchedBy: MemoryRetrievalMatch["type"][];
  entityIds: string[];
};

export type MemoryRetrievalResult = {
  memory: Memory;
  matches: MemoryRetrievalMatch[];
  score: number;
  context: MemoryRetrievalContext;
};

export type MemoryMetadataSuggestion = {
  id: string;
  memoryId: string;
  field: MemoryMetadataSuggestionField;
  value: string;
  matchedValue: string | null;
  confidence: number;
  status: MemoryMetadataSuggestionStatus;
  provider: string | null;
  model: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AttachedPhotoRef = {
  photoId: string;
  mediaKind?: AttachedMediaKind;
  source: AttachedPhotoSource;
  path: string;
  attachedAt: string;
  contentHash?: string;
  filename?: string;
  takenAt?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  mimeType?: string;
  localUri?: string;
  posterPath?: string;
  posterLocalUri?: string;
  syncStatus: AttachedPhotoSyncStatus;
};

export type MemoryCollectionSummary = {
  id: string;
  title: string;
  kind: MemoryCollectionKind;
};

export type MemoryCollection = MemoryCollectionSummary & {
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  memoryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Memory = {
  id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext: MemoryGuidanceContext | null;
  metadata: MemoryMetadata;
  collections: MemoryCollectionSummary[];
  attachedPhotos: AttachedPhotoRef[];
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoryCollectionInput = {
  title: string;
  kind: MemoryCollectionKind;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type CreateMemoryInput = {
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext?: MemoryGuidanceContext | null;
  metadata?: MemoryMetadata;
  collectionIds?: string[];
  attachedPhotos: AttachedPhotoRef[];
};
