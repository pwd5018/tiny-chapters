import type {
  MemoryRetrievalQuery,
  MemoryRetrievalOptions,
} from "@/services/memoryService";
import type { MemoryRetrievalResult } from "@/types/memory";
import {
  recordMemoryProviderAccess,
  requireActiveMemoryProviderGrant,
} from "@/services/provider/providerService";
import type {
  MemoryProviderRetrievalResponse,
} from "@/services/provider/providerTypes";
import { isMemoryProviderDeepLinkForId } from "@/services/provider/providerDeepLink";

export type ProviderMemoryRetriever = (
  query: string | MemoryRetrievalQuery,
  options?: MemoryRetrievalOptions
) => Promise<MemoryRetrievalResult[]>;

export type MemoryProviderRetrievalRequest = {
  providerKey: string;
  query: string | MemoryRetrievalQuery;
  options?: MemoryRetrievalOptions;
};

function toFinalizedQuery(query: string | MemoryRetrievalQuery): MemoryRetrievalQuery {
  if (typeof query === "string") {
    return { query, lifecycleStatuses: ["finalized"] };
  }

  return { ...query, lifecycleStatuses: ["finalized"] };
}

function summarizeQuery(query: string | MemoryRetrievalQuery) {
  if (typeof query === "string") {
    return query.trim() ? "text_query" : "all_finalized";
  }

  const parts = [
    query.query?.trim() ? "text_query" : null,
    query.entityIds?.length ? "entity_filter" : null,
    query.collectionIds?.length ? "collection_filter" : null,
    query.from || query.to ? "date_filter" : null,
  ].filter(Boolean);

  return parts.length ? parts.join(",") : "all_finalized";
}

export function createMemoryProviderAdapter(retrieveMemories: ProviderMemoryRetriever) {
  return async function retrieveForProvider(
    request: MemoryProviderRetrievalRequest
  ): Promise<MemoryProviderRetrievalResponse<MemoryRetrievalResult>> {
    const grant = await requireActiveMemoryProviderGrant(request.providerKey, "memories:read");
    const results = await retrieveMemories(toFinalizedQuery(request.query), request.options);

    for (const result of results) {
      if (!isMemoryProviderDeepLinkForId(result.context.deepLink, result.memory.id)) {
        throw new Error(`Invalid memory deep link returned for ${result.memory.id}.`);
      }
    }

    await recordMemoryProviderAccess({
      grantId: grant.id,
      providerKey: request.providerKey,
      operation: "retrieve_memories",
      scope: "memories:read",
      querySummary: summarizeQuery(request.query),
      resultCount: results.length,
    });

    return {
      contract: "tiny-chapters.memory-retrieval",
      version: "1",
      scope: "memories:read",
      providerKey: request.providerKey,
      items: results,
    };
  };
}
