import type {
  MemoryImportance,
  MemoryLifecycleStatus,
  MemoryMetadata,
} from "@/types/memory";

export const MEMORY_LIFECYCLE_OPTIONS: MemoryLifecycleStatus[] = ["draft", "finalized"];
export const MEMORY_IMPORTANCE_OPTIONS: MemoryImportance[] = [1, 2, 3];

export function createDefaultMemoryMetadata(
  overrides?: Partial<MemoryMetadata>
): MemoryMetadata {
  return {
    lifecycleStatus: overrides?.lifecycleStatus ?? "finalized",
    isFavorite: overrides?.isFavorite ?? false,
    importance: overrides?.importance ?? null,
    people: normalizeMetadataList(overrides?.people),
    places: normalizeMetadataList(overrides?.places),
    projects: normalizeMetadataList(overrides?.projects),
    topics: normalizeMetadataList(overrides?.topics),
  };
}

export function normalizeMetadataList(values: string[] | null | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function parseMetadataList(value: string) {
  return normalizeMetadataList(value.split(","));
}

export function formatMetadataList(values: string[]) {
  return values.join(", ");
}

export function getMemoryLifecycleLabel(status: MemoryLifecycleStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "finalized":
      return "Finalized";
  }
}

export function getMemoryImportanceLabel(importance: MemoryImportance | null) {
  switch (importance) {
    case 1:
      return "Light";
    case 2:
      return "Important";
    case 3:
      return "Core";
    default:
      return "Not set";
  }
}

export function hasConfirmedMetadata(metadata: MemoryMetadata, tags: string[]) {
  return Boolean(
    tags.length ||
      metadata.isFavorite ||
      metadata.importance !== null ||
      metadata.people.length ||
      metadata.places.length ||
      metadata.projects.length ||
      metadata.topics.length
  );
}
