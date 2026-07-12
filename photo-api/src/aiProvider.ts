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
  followUps: string[]
) {
  return [
    "You are helping a private family memory app.",
    "Return only JSON.",
    'Schema: {"polishedText":"..."}',
    "Rules:",
    "- Rewrite the memory into 1 or 2 short natural sentences.",
    "- Keep the meaning grounded in the user's words.",
    "- Preserve specificity from short fragments when helpful.",
    "- Do not invent facts.",
    "- Do not sound corporate or sentimentalized.",
    "- No preamble, no markdown, no explanation.",
    `Base question: ${baseQuestion}`,
    `Original answer: ${originalAnswer}`,
    `Current draft: ${composedText}`,
    `Follow-up answers: ${followUps.join(" | ") || "None"}`,
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
  followUps: string[]
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
