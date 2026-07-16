import express from "express";

import { requireApiKey } from "./auth";
import {
  AiGatewayError,
  generateAiDailyPrompt,
  generateAiFollowUps,
  generateAiMetadataSuggestions,
  generateAiPolish,
  getAiGatewayStatus,
} from "./aiProvider";

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const metadataSuggestionFields = ["tag", "person", "place", "project", "topic"] as const;
type MetadataSuggestionField = (typeof metadataSuggestionFields)[number];

function getMetadataVocabulary(value: unknown): Record<MetadataSuggestionField, string[]> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(
    metadataSuggestionFields.map((field) => [
      field,
      Array.isArray(source[field])
        ? source[field]
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 80)
        : [],
    ])
  ) as Record<MetadataSuggestionField, string[]>;
}

function getPolishFollowUps(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ question: string; answer: string }>;
  }

  return value
    .map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        question: getStringField(record.question),
        answer: getStringField(record.answer),
      };
    })
    .filter((followUp) => followUp.question && followUp.answer);
}

export function createAiRouter() {
  const router = express.Router();

  router.use(requireApiKey);

  router.get("/ai/status", (_req, res) => {
    res.json(getAiGatewayStatus());
  });

  router.post("/ai/daily-prompt", async (req, res) => {
    const dateLabel = getStringField(req.body?.dateLabel);
    const memoryCountForDay =
      typeof req.body?.memoryCountForDay === "number" && Number.isFinite(req.body.memoryCountForDay)
        ? Math.max(0, Math.floor(req.body.memoryCountForDay))
        : 0;
    const priorPrompts = Array.isArray(req.body?.priorPrompts)
      ? req.body.priorPrompts
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

    if (!dateLabel) {
      res.status(400).json({ error: "dateLabel is required." });
      return;
    }

    try {
      const result = await generateAiDailyPrompt(dateLabel, memoryCountForDay, priorPrompts);
      res.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "AI daily prompt generation failed." });
    }
  });

  router.post("/ai/follow-ups", async (req, res) => {
    const baseQuestion = getStringField(req.body?.baseQuestion);
    const originalAnswer = getStringField(req.body?.originalAnswer);
    const composedText = getStringField(req.body?.composedText);
    const followUps = Array.isArray(req.body?.followUps)
      ? req.body.followUps
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

    if (!baseQuestion || !originalAnswer) {
      res.status(400).json({ error: "baseQuestion and originalAnswer are required." });
      return;
    }

    try {
      const result = await generateAiFollowUps(
        baseQuestion,
        originalAnswer,
        composedText,
        followUps
      );
      res.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "AI follow-up generation failed." });
    }
  });

  router.post("/ai/polish", async (req, res) => {
    const baseQuestion = getStringField(req.body?.baseQuestion);
    const originalAnswer = getStringField(req.body?.originalAnswer);
    const composedText = getStringField(req.body?.composedText);
    const followUps = getPolishFollowUps(req.body?.followUps);

    if (!baseQuestion || !originalAnswer || !composedText) {
      res.status(400).json({
        error: "baseQuestion, originalAnswer, and composedText are required.",
      });
      return;
    }

    try {
      const result = await generateAiPolish(
        baseQuestion,
        originalAnswer,
        composedText,
        followUps
      );
      res.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "AI polish generation failed." });
    }
  });

  router.post("/ai/metadata-suggestions", async (req, res) => {
    const text = getStringField(req.body?.text);
    const vocabulary = getMetadataVocabulary(req.body?.vocabulary);

    if (!text) {
      res.status(400).json({ error: "text is required." });
      return;
    }

    try {
      const result = await generateAiMetadataSuggestions(text, vocabulary);
      res.json(result);
    } catch (error) {
      if (error instanceof AiGatewayError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "AI metadata suggestion generation failed." });
    }
  });

  return router;
}
