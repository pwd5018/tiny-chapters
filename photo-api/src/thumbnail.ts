import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { config } from "./config";

fs.mkdirSync(config.thumbnailCacheDir, { recursive: true });

const inFlightThumbnails = new Map<string, Promise<string>>();

export async function ensureThumbnail(photoId: string, sourcePath: string) {
  const outputPath = path.join(config.thumbnailCacheDir, `${photoId}.jpg`);

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  const existingGeneration = inFlightThumbnails.get(outputPath);
  if (existingGeneration) {
    return existingGeneration;
  }

  const generation = sharp(sourcePath)
    .rotate()
    .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outputPath)
    .then(() => outputPath)
    .finally(() => {
      inFlightThumbnails.delete(outputPath);
    });

  inFlightThumbnails.set(outputPath, generation);

  return generation;
}
