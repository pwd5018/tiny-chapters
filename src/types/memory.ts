export type AttachedPhotoSource = "nas" | "local" | "mock";
export type AttachedPhotoSyncStatus =
  | "local_only"
  | "pending_nas_match"
  | "linked_to_nas"
  | "missing"
  | "preserved_copy";

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

export type AttachedPhotoRef = {
  photoId: string;
  source: AttachedPhotoSource;
  path: string;
  attachedAt: string;
  contentHash?: string;
  filename?: string;
  takenAt?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  localUri?: string;
  syncStatus: AttachedPhotoSyncStatus;
};

export type Memory = {
  id: string;
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext: MemoryGuidanceContext | null;
  attachedPhotos: AttachedPhotoRef[];
  createdAt: string;
  updatedAt: string;
};

export type CreateMemoryInput = {
  date: string;
  prompt: string;
  text: string;
  tags: string[];
  guidedContext?: MemoryGuidanceContext | null;
  attachedPhotos: AttachedPhotoRef[];
};
