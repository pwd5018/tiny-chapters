import { nasPhotoApiBaseUrl, nasPhotoApiKey } from "@/config/appConfig";
import type { GuidedMemoryDraft } from "@/types/memory";
import type { MemoryMetadataSuggestionField } from "@/types/memory";

const REQUEST_TIMEOUT_MS = 15000;

type FollowUpsGatewayResponse = {
  questions: string[];
  provider: string;
  model: string;
};

type DailyPromptGatewayResponse = {
  prompt: string;
  provider: string;
  model: string;
};

type PolishGatewayResponse = {
  polishedText: string;
  provider: string;
  model: string;
};

export type MetadataSuggestionVocabulary = Record<MemoryMetadataSuggestionField, string[]>;

export type AiMetadataSuggestion = {
  field: MemoryMetadataSuggestionField;
  value: string;
  confidence: number;
  matchedValue: string | null;
};

type MetadataSuggestionsGatewayResponse = {
  suggestions: AiMetadataSuggestion[];
  provider: string;
  model: string;
};

function createTimeoutSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function getGatewayBaseUrl() {
  return nasPhotoApiBaseUrl.replace(/\/+$/, "");
}

export function isAiGatewayConfigured() {
  return Boolean(getGatewayBaseUrl() && nasPhotoApiKey);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function createAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${nasPhotoApiKey}`,
  };
}

export async function generateGuidedFollowUpsWithAi(
  baseQuestion: string,
  originalAnswer: string,
  composedText: string,
  followUps: string[]
) {
  if (!isAiGatewayConfigured()) {
    throw new Error("AI gateway is not configured.");
  }

  const timeout = createTimeoutSignal();

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/ai/follow-ups`, {
      method: "POST",
      signal: timeout.signal,
      headers: createAuthHeaders(),
      body: JSON.stringify({
        baseQuestion,
        originalAnswer,
        composedText,
        followUps,
      }),
    });

    if (!response.ok) {
      const payload: { error?: string } = await parseJsonResponse<{ error?: string }>(
        response
      ).catch(() => ({}));
      throw new Error(payload.error || `AI follow-up request failed with HTTP ${response.status}.`);
    }

    return parseJsonResponse<FollowUpsGatewayResponse>(response);
  } finally {
    timeout.clear();
  }
}

export async function generateDailyPromptWithAi(
  dateLabel: string,
  memoryCountForDay: number,
  priorPrompts: string[]
) {
  if (!isAiGatewayConfigured()) {
    throw new Error("AI gateway is not configured.");
  }

  const timeout = createTimeoutSignal();

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/ai/daily-prompt`, {
      method: "POST",
      signal: timeout.signal,
      headers: createAuthHeaders(),
      body: JSON.stringify({
        dateLabel,
        memoryCountForDay,
        priorPrompts,
      }),
    });

    if (!response.ok) {
      const payload: { error?: string } = await parseJsonResponse<{ error?: string }>(
        response
      ).catch(() => ({}));
      throw new Error(payload.error || `AI daily prompt request failed with HTTP ${response.status}.`);
    }

    return parseJsonResponse<DailyPromptGatewayResponse>(response);
  } finally {
    timeout.clear();
  }
}

export async function polishGuidedMemoryWithAi(draft: GuidedMemoryDraft) {
  if (!isAiGatewayConfigured()) {
    throw new Error("AI gateway is not configured.");
  }

  const timeout = createTimeoutSignal();

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/ai/polish`, {
      method: "POST",
      signal: timeout.signal,
      headers: createAuthHeaders(),
      body: JSON.stringify({
        baseQuestion: draft.baseQuestion,
        originalAnswer: draft.originalAnswer,
        composedText: draft.composedText,
        followUps: draft.followUps
          .filter((followUp) => followUp.status === "answered" && followUp.answer.trim())
          .map((followUp) => followUp.answer.trim()),
      }),
    });

    if (!response.ok) {
      const payload: { error?: string } = await parseJsonResponse<{ error?: string }>(
        response
      ).catch(() => ({}));
      throw new Error(payload.error || `AI polish request failed with HTTP ${response.status}.`);
    }

    return parseJsonResponse<PolishGatewayResponse>(response);
  } finally {
    timeout.clear();
  }
}

export async function generateMetadataSuggestionsWithAi(input: {
  prompt: string;
  text: string;
  vocabulary: MetadataSuggestionVocabulary;
}) {
  if (!isAiGatewayConfigured()) {
    throw new Error("AI gateway is not configured.");
  }

  const timeout = createTimeoutSignal();

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/ai/metadata-suggestions`, {
      method: "POST",
      signal: timeout.signal,
      headers: createAuthHeaders(),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const payload: { error?: string } = await parseJsonResponse<{ error?: string }>(
        response
      ).catch(() => ({}));
      throw new Error(payload.error || `AI metadata suggestion request failed with HTTP ${response.status}.`);
    }

    return parseJsonResponse<MetadataSuggestionsGatewayResponse>(response);
  } finally {
    timeout.clear();
  }
}
