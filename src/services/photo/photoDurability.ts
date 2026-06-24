import type { AttachedPhotoRef, AttachedPhotoSyncStatus } from "@/types/memory";

export function normalizeAttachedPhotoSyncStatus(
  value: string | null | undefined,
  fallback: AttachedPhotoSyncStatus = "linked_to_nas"
): AttachedPhotoSyncStatus {
  switch (value) {
    case "local_only":
    case "pending_nas_match":
    case "linked_to_nas":
    case "missing":
    case "preserved_copy":
      return value;
    default:
      return fallback;
  }
}

export function getAttachedPhotoSyncStatusLabel(status: AttachedPhotoSyncStatus) {
  switch (status) {
    case "pending_nas_match":
      return "Waiting for NAS backup";
    case "linked_to_nas":
      return "Linked to NAS archive";
    case "local_only":
      return "Local only";
    case "missing":
      return "Missing";
    case "preserved_copy":
      return "Preserved copy";
  }
}

export function getAttachedPhotoDisplayName(ref: AttachedPhotoRef) {
  if (ref.filename?.trim()) {
    return ref.filename;
  }

  if (ref.localUri) {
    const localUriParts = ref.localUri.split("/");
    return localUriParts[localUriParts.length - 1] || "Captured photo";
  }

  const pathParts = ref.path.split(/[\\/]/);
  return pathParts[pathParts.length - 1] || ref.photoId;
}

export function getAttachedPhotoPreviewUri(ref: AttachedPhotoRef) {
  if (ref.localUri) {
    return ref.localUri;
  }

  if (
    ref.path.startsWith("file:") ||
    ref.path.startsWith("content:") ||
    ref.path.startsWith("http://") ||
    ref.path.startsWith("https://")
  ) {
    return ref.path;
  }

  return null;
}

export function summarizeAttachedPhotoStatuses(refs: AttachedPhotoRef[]) {
  const counts = {
    linked: 0,
    pending: 0,
    localOnly: 0,
    missing: 0,
    preservedCopy: 0,
  };

  for (const ref of refs) {
    switch (ref.syncStatus) {
      case "linked_to_nas":
        counts.linked += 1;
        break;
      case "pending_nas_match":
        counts.pending += 1;
        break;
      case "local_only":
        counts.localOnly += 1;
        break;
      case "missing":
        counts.missing += 1;
        break;
      case "preserved_copy":
        counts.preservedCopy += 1;
        break;
    }
  }

  if (!refs.length) {
    return "No attached photos";
  }

  if (counts.pending > 0) {
    return `${counts.pending} waiting for NAS backup`;
  }

  if (counts.localOnly > 0) {
    return `${counts.localOnly} local only`;
  }

  if (counts.missing > 0) {
    return `${counts.missing} missing`;
  }

  if (counts.preservedCopy > 0) {
    return `${counts.preservedCopy} preserved copy`;
  }

  return "All linked to NAS archive";
}
