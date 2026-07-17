import { config, type AiProviderName } from "./config";

const REQUEST_TIMEOUT_MS = 15000;

type FollowUpResult = {
  questions: string[];
  provider: AiProviderName;
  model: string;
};

type DailyPromptResult = {
  prompt: string;
  provider: AiProviderName;
  model: string;
};

type PolishResult = {
  polishedText: string;
  provider: AiProviderName;
  model: string;
};

type PolishFollowUp = {
  question: string;
  answer: string;
};

type MetadataSuggestionField = "tag" | "person" | "place" | "project" | "topic";

type MetadataSuggestionResult = {
  suggestions: Array<{
    field: MetadataSuggestionField;
    value: string;
    confidence: number;
    matchedValue: string | null;
    evidence: string;
  }>;
  provider: AiProviderName;
  model: string;
};

type MetadataSuggestionVocabulary = Record<MetadataSuggestionField, string[]>;

export class AiGatewayError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "AiGatewayError";
    this.statusCode = statusCode;
  }
}

function ensureAiConfigured() {
  if (!config.aiProvider) {
    throw new AiGatewayError("AI provider is not configured on the local gateway.", 503);
  }
}

function createTimeoutSignal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function extractJsonBlock(rawText: string) {
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new AiGatewayError("AI provider returned an empty response.", 502);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new AiGatewayError("AI provider did not return valid JSON.", 502);
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function parseFollowUpsFromText(rawText: string) {
  const parsed = JSON.parse(extractJsonBlock(rawText)) as Record<string, unknown>;
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((value): value is string => typeof value === "string")
    : [];

  return questions.map((question) => question.trim()).filter(Boolean).slice(0, 3);
}

function parseDailyPromptFromText(rawText: string) {
  const parsed = JSON.parse(extractJsonBlock(rawText)) as Record<string, unknown>;
  const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";

  if (!prompt) {
    throw new AiGatewayError("AI provider returned an empty daily prompt.", 502);
  }

  return prompt;
}

function parsePolishedTextFromText(rawText: string) {
  const parsed = JSON.parse(extractJsonBlock(rawText)) as Record<string, unknown>;
  const polishedText =
    typeof parsed.polishedText === "string" ? parsed.polishedText.trim() : "";

  if (!polishedText) {
    throw new AiGatewayError("AI provider returned an empty polished suggestion.", 502);
  }

  return polishedText;
}

function isDurableMetadataSuggestion(
  field: MetadataSuggestionField,
  value: string
) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const wordCount = normalized.split(" ").filter(Boolean).length;

  if (wordCount > 3) {
    return false;
  }

  if (field !== "tag" && field !== "topic") {
    return true;
  }

  const incidentalValues = new Set([
    "day",
    "week",
    "feeling",
    "good mood",
    "feeling good",
    "sore throat",
    "headache",
    "cough",
    "cold",
    "fever",
    "fatigue",
    "tired",
    "sick",
    "illness",
  ]);

  return (
    !incidentalValues.has(normalized) &&
    !normalized.startsWith("feeling ") &&
    !normalized.startsWith("felt ")
  );
}

function normalizeEvidence(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMetadataSuggestionsFromText(rawText: string, sourceText: string) {
  const parsed = JSON.parse(extractJsonBlock(rawText)) as Record<string, unknown>;
  const allowedFields = new Set<MetadataSuggestionField>([
    "tag",
    "person",
    "place",
    "project",
    "topic",
  ]);

  if (!Array.isArray(parsed.suggestions)) {
    return [];
  }

  const seen = new Set<string>();
  const suggestions: MetadataSuggestionResult["suggestions"] = [];

  for (const candidate of parsed.suggestions) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const field = typeof record.field === "string" ? record.field : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    const matchedValue =
      typeof record.matchedValue === "string" && record.matchedValue.trim()
        ? record.matchedValue.trim()
        : null;
    const rawConfidence = typeof record.confidence === "number" ? record.confidence : 0;
    const evidence = typeof record.evidence === "string" ? record.evidence.trim() : "";
    const normalizedEvidence = normalizeEvidence(evidence);

    if (
      !allowedFields.has(field as MetadataSuggestionField) ||
      !value ||
      !normalizedEvidence ||
      !normalizeEvidence(sourceText).includes(normalizedEvidence) ||
      !isDurableMetadataSuggestion(field as MetadataSuggestionField, value)
    ) {
      continue;
    }

    const key = `${field}:${value.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    suggestions.push({
      field: field as MetadataSuggestionField,
      value,
      matchedValue,
      confidence: Math.max(0, Math.min(100, Math.round(rawConfidence))),
      evidence,
    });

    if (suggestions.length >= 8) {
      break;
    }
  }

  return suggestions;
}

function extractOpenAiResponsesText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new AiGatewayError("OpenAI-style provider returned an invalid response.", 502);
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    for (const outputItem of record.output) {
      if (!outputItem || typeof outputItem !== "object") {
        continue;
      }

      const outputRecord = outputItem as Record<string, unknown>;
      const content = outputRecord.content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content) {
        if (!contentItem || typeof contentItem !== "object") {
          continue;
        }

        const contentRecord = contentItem as Record<string, unknown>;

        if (typeof contentRecord.text === "string" && contentRecord.text.trim()) {
          return contentRecord.text;
        }
      }
    }
  }

  throw new AiGatewayError("OpenAI-style provider returned no text output.", 502);
}

function extractGroqText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new AiGatewayError("Groq returned an invalid response.", 502);
  }

  const record = payload as Record<string, unknown>;
  const choices = record.choices;

  if (!Array.isArray(choices) || !choices.length) {
    throw new AiGatewayError("Groq returned no choices.", 502);
  }

  const message = (choices[0] as Record<string, unknown>).message;
  const content =
    message && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : null;

  if (typeof content !== "string" || !content.trim()) {
    throw new AiGatewayError("Groq returned an empty message.", 502);
  }

  return content;
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new AiGatewayError("Gemini returned an invalid response.", 502);
  }

  const record = payload as Record<string, unknown>;
  const candidates = record.candidates;

  if (!Array.isArray(candidates) || !candidates.length) {
    throw new AiGatewayError("Gemini returned no candidates.", 502);
  }

  const content = (candidates[0] as Record<string, unknown>).content;
  const parts =
    content && typeof content === "object"
      ? (content as Record<string, unknown>).parts
      : null;

  if (!Array.isArray(parts)) {
    throw new AiGatewayError("Gemini returned no text parts.", 502);
  }

  const text = parts
    .map((part) =>
      part && typeof part === "object" ? (part as Record<string, unknown>).text : null
    )
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .trim();

  if (!text) {
    throw new AiGatewayError("Gemini returned an empty text payload.", 502);
  }

  return text;
}

function createFollowUpsPrompt(
  baseQuestion: string,
  originalAnswer: string,
  composedText: string,
  followUps: string[]
) {
  return [
    "You are helping a private family memory app.",
    "Return only JSON.",
    'Schema: {"questions":["...", "...", "..."]}',
    "Rules:",
    "- Return 1 to 3 gentle follow-up questions.",
    "- Base the next questions only on this one in-progress memory.",
    "- Use the draft-so-far and any prior follow-up answers when they are provided.",
    "- Keep them warm, supportive, and non-intrusive.",
    "- Do not repeat the base question.",
    "- Do not repeat or paraphrase an already answered follow-up.",
    "- Keep each question under 18 words.",
    "- No preamble, no markdown, no explanation.",
    `Base question: ${baseQuestion}`,
    `Original answer: ${originalAnswer}`,
    `Current draft: ${composedText || "None"}`,
    `Already answered follow-ups: ${followUps.join(" | ") || "None"}`,
  ].join("\n");
}

function createDailyPromptPrompt(
  dateLabel: string,
  memoryCountForDay: number,
  priorPrompts: string[]
) {
  return [
    "You are helping a private family memory app.",
    "Return only JSON.",
    'Schema: {"prompt":"..."}',
    "Rules:",
    "- Write exactly one warm opening question for capturing a small family memory.",
    "- Keep it specific, gentle, and easy to answer.",
    "- Keep it under 18 words.",
    "- Avoid sounding generic, corporate, or sentimentalized.",
    "- If memories already exist for this day, offer a fresh angle instead of repeating earlier prompts.",
    "- Do not mention counts, streaks, apps, saving, archives, or journaling.",
    "- End as a question.",
    "- No preamble, no markdown, no explanation.",
    `Date: ${dateLabel}`,
    `Existing memories already saved for this date: ${memoryCountForDay}`,
    `Earlier prompts already used for this date: ${priorPrompts.join(" | ") || "None"}`,
  ].join("\n");
}

function createPolishPrompt(
  baseQuestion: string,
  originalAnswer: string,
  composedText: string,
  followUps: PolishFollowUp[]
) {
  return [
    "You are helping a private family memory app.",
    "Return only JSON.",
    'Schema: {"polishedText":"..."}',
    "Rules:",
    "- Rewrite the memory into 1 or 2 short natural sentences.",
    "- Keep the meaning grounded in the user's words.",
    "- The original answer provides context, but the current draft is the latest user-authored version and must be treated as authoritative.",
    "- Preserve every clear, substantive detail the user added to the current draft, including newly added people, places, and actions.",
    "- Each follow-up answer belongs only to its paired question. Use the question to resolve a short answer such as who watched, but never transfer that answer to the people in the main event.",
    "- The current draft may contain raw fragments. Do not treat it as an already coherent sentence or merge fragments merely because they are adjacent.",
    "- If a follow-up is incomplete or its relationship is unclear, omit it instead of inventing a connection.",
    "- Do not invent facts, participants, feelings, or actions.",
    "- Do not sound corporate or sentimentalized.",
    "- No preamble, no markdown, no explanation.",
    `Base question: ${baseQuestion}`,
    `Original answer: ${originalAnswer}`,
    `Current draft: ${composedText}`,
    `Follow-ups with their questions: ${
      followUps.map((followUp) => `Q: ${followUp.question} A: ${followUp.answer}`).join(" | ") ||
      "None"
    }`,
  ].join("\n");
}

function createMetadataSuggestionsPrompt(
  text: string,
  vocabulary: MetadataSuggestionVocabulary
) {
  return [
    "You are a careful archive curator for a private life-memory app, not a keyword extractor.",
    "Return only JSON.",
    'Schema: {"suggestions":[{"field":"tag|person|place|project|topic","value":"...","confidence":0,"matchedValue":"... or null","evidence":"exact quote"}]}',
    "Rules:",
    "- Use only the chapter text below. Do not infer metadata from the writing prompt or from existing vocabulary alone.",
    "- Every suggestion needs evidence: copy a contiguous one-to-eight-word quote from the chapter text into evidence. If no exact quote supports it, omit the suggestion.",
    "- It is valid, and preferred, to return an empty suggestions array for a small or incidental entry.",
    "- Return every distinct clearly named person, place, project, or durable topic that is meaningfully central, up to 8 suggestions total.",
    "- confidence is an integer from 0 to 100 measuring durable archive relevance, not certainty that words were mentioned.",
    "- First try to match an existing value in the same field. If one is a clear match, copy it exactly into matchedValue and value.",
    "- If no existing value is a clear match, set matchedValue to null and use a concise new value.",
    "- Suggest people, places, or projects only when specifically named and meaningfully central to the chapter.",
    "- Suggest a topic only when it is a broad, durable theme that substantially shapes the chapter. A passing mention does not qualify.",
    "- Never suggest moods, feelings, wellness states, physical symptoms, minor illnesses, routine chores, appointments, generic day/week reflections, or complete phrases as tags or topics.",
    "- Do not create a person merely from a generic role such as mom, dad, friend, or teacher unless the text names them.",
    "- Values should normally be one to three words.",
    "- No preamble, no markdown, no explanation.",
    `Chapter text: ${text}`,
    `Existing tags: ${vocabulary.tag.join(" | ") || "None"}`,
    `Existing people: ${vocabulary.person.join(" | ") || "None"}`,
    `Existing places: ${vocabulary.place.join(" | ") || "None"}`,
    `Existing projects: ${vocabulary.project.join(" | ") || "None"}`,
    `Existing topics: ${vocabulary.topic.join(" | ") || "None"}`,
  ].join("\n");
}

async function callOpenAiResponsesApi(prompt: string, apiKey: string, model: string) {
  const timeout = createTimeoutSignal();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.4,
        max_output_tokens: 250,
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new AiGatewayError(
        `OpenAI request failed with HTTP ${response.status}.`,
        response.status
      );
    }

    return extractOpenAiResponsesText(payload);
  } finally {
    timeout.clear();
  }
}

async function callGroqApi(prompt: string, apiKey: string, model: string) {
  const timeout = createTimeoutSignal();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You return only compact JSON for a private family memory writing assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new AiGatewayError(
        `Groq request failed with HTTP ${response.status}.`,
        response.status
      );
    }

    return extractGroqText(payload);
  } finally {
    timeout.clear();
  }
}

async function callGeminiApi(prompt: string, apiKey: string, model: string) {
  const timeout = createTimeoutSignal();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        signal: timeout.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 250,
          },
        }),
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new AiGatewayError(
        `Gemini request failed with HTTP ${response.status}.`,
        response.status
      );
    }

    return extractGeminiText(payload);
  } finally {
    timeout.clear();
  }
}

async function callProvider(prompt: string) {
  ensureAiConfigured();

  switch (config.aiProvider) {
    case "openai":
      if (!config.openAiApiKey || !config.openAiModel) {
        throw new AiGatewayError("OpenAI is selected but its key or model is missing.", 503);
      }
      return {
        text: await callOpenAiResponsesApi(prompt, config.openAiApiKey, config.openAiModel),
        provider: config.aiProvider,
        model: config.openAiModel,
      };
    case "groq":
      if (!config.groqApiKey || !config.groqModel) {
        throw new AiGatewayError("Groq is selected but its key or model is missing.", 503);
      }
      return {
        text: await callGroqApi(prompt, config.groqApiKey, config.groqModel),
        provider: config.aiProvider,
        model: config.groqModel,
      };
    case "gemini":
      if (!config.geminiApiKey || !config.geminiModel) {
        throw new AiGatewayError("Gemini is selected but its key or model is missing.", 503);
      }
      return {
        text: await callGeminiApi(prompt, config.geminiApiKey, config.geminiModel),
        provider: config.aiProvider,
        model: config.geminiModel,
      };
    default:
      throw new AiGatewayError("AI provider is not configured on the local gateway.", 503);
  }
}

export function getAiGatewayStatus() {
  const enabled =
    (config.aiProvider === "openai" && Boolean(config.openAiApiKey && config.openAiModel)) ||
    (config.aiProvider === "groq" && Boolean(config.groqApiKey && config.groqModel)) ||
    (config.aiProvider === "gemini" && Boolean(config.geminiApiKey && config.geminiModel));

  return {
    enabled,
    provider: config.aiProvider,
    model:
      config.aiProvider === "openai"
        ? config.openAiModel
        : config.aiProvider === "groq"
          ? config.groqModel
          : config.aiProvider === "gemini"
            ? config.geminiModel
            : null,
  };
}

export async function generateAiFollowUps(
  baseQuestion: string,
  originalAnswer: string,
  composedText: string,
  followUps: string[]
): Promise<FollowUpResult> {
  const prompt = createFollowUpsPrompt(
    baseQuestion,
    originalAnswer,
    composedText,
    followUps
  );
  const result = await callProvider(prompt);
  const questions = parseFollowUpsFromText(result.text);

  if (!questions.length) {
    throw new AiGatewayError("AI provider returned no usable follow-up questions.", 502);
  }

  return {
    questions,
    provider: result.provider,
    model: result.model,
  };
}

export async function generateAiDailyPrompt(
  dateLabel: string,
  memoryCountForDay: number,
  priorPrompts: string[]
): Promise<DailyPromptResult> {
  const prompt = createDailyPromptPrompt(dateLabel, memoryCountForDay, priorPrompts);
  const result = await callProvider(prompt);
  const dailyPrompt = parseDailyPromptFromText(result.text);

  return {
    prompt: dailyPrompt,
    provider: result.provider,
    model: result.model,
  };
}

export async function generateAiPolish(
  baseQuestion: string,
  originalAnswer: string,
  composedText: string,
  followUps: PolishFollowUp[]
): Promise<PolishResult> {
  const prompt = createPolishPrompt(baseQuestion, originalAnswer, composedText, followUps);
  const result = await callProvider(prompt);
  const polishedText = parsePolishedTextFromText(result.text);

  return {
    polishedText,
    provider: result.provider,
    model: result.model,
  };
}

export async function generateAiMetadataSuggestions(
  text: string,
  vocabulary: MetadataSuggestionVocabulary
): Promise<MetadataSuggestionResult> {
  const result = await callProvider(createMetadataSuggestionsPrompt(text, vocabulary));

  return {
    suggestions: parseMetadataSuggestionsFromText(result.text, text),
    provider: result.provider,
    model: result.model,
  };
}
