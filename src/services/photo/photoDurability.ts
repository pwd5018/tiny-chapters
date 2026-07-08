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
      return "Waiting for NAS match";
    case "linked_to_nas":
      return "Linked to NAS archive";
    case "local_only":
      return "Saved on this device";
    case "missing":
      return "Archive photo unavailable";
    case "preserved_copy":
      return "Preserved copy";
  }
}

export function getAttachedPhotoStatusNote(ref: AttachedPhotoRef) {
  switch (ref.syncStatus) {
    case "pending_nas_match":
      return "This photo is attached now and Tiny Chapters will keep trying to match it to your NAS archive.";
    case "linked_to_nas":
      return "This memory now points at the NAS archive, so it should stay previewable across devices.";
    case "local_only":
      return "This photo only lives on the current device for now, so preview availability may not carry to another phone.";
    case "missing":
      return "The archive reference is saved, but the original photo is not reachable right now.";
    case "preserved_copy":
      return "Tiny Chapters is using a preserved copy because the original reference is not available.";
  }
}

export function getAttachedPhotoSourceLabel(ref: AttachedPhotoRef) {
  switch (ref.source) {
    case "nas":
      return "NAS archive";
    case "mock":
      return "Mock source";
    case "local":
      return ref.syncStatus === "linked_to_nas" ? "Phone photo (matched to NAS)" : "Phone photo";
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
  if (ref.localUri && ref.syncStatus !== "linked_to_nas") {
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

  if (counts.missing > 0) {
    return `${counts.missing} archive photo${counts.missing === 1 ? "" : "s"} unavailable`;
  }

  if (counts.pending > 0) {
    return `${counts.pending} waiting for NAS match`;
  }

  if (counts.localOnly > 0) {
    return `${counts.localOnly} saved on this device`;
  }

  if (counts.preservedCopy > 0) {
    return `${counts.preservedCopy} preserved copy`;
  }

  return "All linked to NAS archive";
}
