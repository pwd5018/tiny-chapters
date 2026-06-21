import type { NextFunction, Request, Response } from "express";

import { config } from "./config";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  const expected = `Bearer ${config.photoApiKey}`;

  if (!authHeader || authHeader !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
