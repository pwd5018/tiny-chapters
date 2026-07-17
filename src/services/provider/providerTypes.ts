export type MemoryProviderGrantStatus = "active" | "revoked";

export type MemoryProviderScope = "memories:read";

export type MemoryProviderGrant = {
  id: string;
  providerKey: string;
  providerLabel: string;
  scopes: MemoryProviderScope[];
  status: MemoryProviderGrantStatus;
  grantedAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type MemoryProviderAccessLog = {
  id: string;
  grantId: string | null;
  providerKey: string;
  operation: "retrieve_memories";
  scope: MemoryProviderScope;
  querySummary: string | null;
  resultCount: number;
  createdAt: string;
};

export type MemoryProviderRetrievalContract = {
  contract: "tiny-chapters.memory-retrieval";
  version: "1";
  scope: "memories:read";
};

export type MemoryProviderRetrievalResponse<T> = MemoryProviderRetrievalContract & {
  providerKey: string;
  items: T[];
};
