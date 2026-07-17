import { getCurrentUser } from "@/services/auth/authService";
import { supabase } from "@/lib/supabase";
import {
  MemoryProviderAccessLog,
  MemoryProviderGrant,
  MemoryProviderGrantStatus,
  MemoryProviderScope,
} from "@/services/provider/providerTypes";

type ProviderGrantRow = {
  id: string;
  provider_key: string;
  provider_label: string;
  scopes: string[];
  status: MemoryProviderGrantStatus;
  granted_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to manage provider access.");
  }

  return user.id;
}

function mapGrant(row: ProviderGrantRow): MemoryProviderGrant {
  return {
    id: row.id,
    providerKey: row.provider_key,
    providerLabel: row.provider_label,
    scopes: row.scopes.filter((scope): scope is MemoryProviderScope => scope === "memories:read"),
    status: row.status,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export async function listMemoryProviderGrants(): Promise<MemoryProviderGrant[]> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("memory_provider_grants")
    .select("id, provider_key, provider_label, scopes, status, granted_at, revoked_at, last_used_at")
    .eq("user_id", userId)
    .order("provider_label", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapGrant(row as ProviderGrantRow));
}

export async function requireActiveMemoryProviderGrant(
  providerKey: string,
  scope: MemoryProviderScope
): Promise<MemoryProviderGrant> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("memory_provider_grants")
    .select("id, provider_key, provider_label, scopes, status, granted_at, revoked_at, last_used_at")
    .eq("user_id", userId)
    .eq("provider_key", providerKey)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`Provider access is not active for ${providerKey}.`);
  }

  const grant = mapGrant(data as ProviderGrantRow);
  if (!grant.scopes.includes(scope)) {
    throw new Error(`Provider ${providerKey} is missing the ${scope} scope.`);
  }

  return grant;
}

export async function grantMemoryProviderAccess(input: {
  providerKey: string;
  providerLabel: string;
  scopes: MemoryProviderScope[];
}): Promise<MemoryProviderGrant> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("memory_provider_grants")
    .upsert(
      {
        user_id: userId,
        provider_key: input.providerKey,
        provider_label: input.providerLabel,
        scopes: input.scopes,
        status: "active",
        revoked_at: null,
      },
      { onConflict: "user_id,provider_key" }
    )
    .select("id, provider_key, provider_label, scopes, status, granted_at, revoked_at, last_used_at")
    .single();

  if (error) {
    throw error;
  }

  return mapGrant(data as ProviderGrantRow);
}

export async function revokeMemoryProviderAccess(providerKey: string): Promise<void> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { error } = await client
    .from("memory_provider_grants")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider_key", providerKey)
    .eq("status", "active");

  if (error) {
    throw error;
  }
}

export async function recordMemoryProviderAccess(input: {
  grantId: string;
  providerKey: string;
  operation: "retrieve_memories";
  scope: MemoryProviderScope;
  querySummary?: string | null;
  resultCount: number;
}): Promise<void> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { error } = await client.from("memory_provider_access_logs").insert({
    user_id: userId,
    grant_id: input.grantId,
    provider_key: input.providerKey,
    operation: input.operation,
    scope: input.scope,
    query_summary: input.querySummary ?? null,
    result_count: input.resultCount,
  });

  if (error) {
    throw error;
  }

  const { error: updateError } = await client
    .from("memory_provider_grants")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", input.grantId)
    .eq("user_id", userId)
    .eq("provider_key", input.providerKey)
    .eq("status", "active");

  if (updateError) {
    throw updateError;
  }
}

export async function listMemoryProviderAccessLogs(): Promise<MemoryProviderAccessLog[]> {
  const client = requireSupabase();
  const userId = await requireUserId();
  const { data, error } = await client
    .from("memory_provider_access_logs")
    .select("id, grant_id, provider_key, operation, scope, query_summary, result_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    grantId: row.grant_id,
    providerKey: row.provider_key,
    operation: row.operation,
    scope: row.scope,
    querySummary: row.query_summary,
    resultCount: row.result_count,
    createdAt: row.created_at,
  })) as MemoryProviderAccessLog[];
}
