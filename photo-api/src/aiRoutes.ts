import express from "express";

import { requireApiKey } from "./auth";
import {
  AiGatewayError,
  generateAiFollowUps,
  generateAiPolish,
  getAiGatewayStatus,
} from "./aiProvider";

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createAiRouter() {
  const router = express.Router();

  router.use(requireApiKey);

  router.get("/ai/status", (_req, res) => {
    res.json(getAiGatewayStatus());
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
    const followUps = Array.isArray(req.body?.followUps)
      ? req.body.followUps
          .filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : [];

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

  return router;
}
