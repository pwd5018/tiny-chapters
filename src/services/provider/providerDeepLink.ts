const MEMORY_DEEP_LINK_PATTERN = /^\/memory\/([^/?#]+)$/;

export function buildMemoryProviderDeepLink(memoryId: string): string {
  return `/memory/${encodeURIComponent(memoryId)}`;
}

export function isMemoryProviderDeepLinkForId(deepLink: string, memoryId: string): boolean {
  const match = deepLink.match(MEMORY_DEEP_LINK_PATTERN);
  if (!match) {
    return false;
  }

  try {
    return decodeURIComponent(match[1]) === memoryId;
  } catch {
    return false;
  }
}
