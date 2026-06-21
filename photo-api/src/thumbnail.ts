import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { config } from "./config";

fs.mkdirSync(config.thumbnailCacheDir, { recursive: true });

export async function ensureThumbnail(photoId: string, sourcePath: string) {
  const outputPath = path.join(config.thumbnailCacheDir, `${photoId}.jpg`);

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  await sharp(sourcePath)
    .rotate()
    .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  return outputPath;
}
