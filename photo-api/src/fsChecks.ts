import fs from "node:fs";

import { logError, logInfo } from "./logger";

export async function checkPhotoRootReachable(photoLibraryRoot: string) {
  try {
    await fs.promises.access(photoLibraryRoot, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function logPhotoRootStatus(photoLibraryRoot: string, context: string) {
  const reachable = await checkPhotoRootReachable(photoLibraryRoot);

  if (reachable) {
    logInfo(`Photo library root is reachable for ${context}.`, {
      photoLibraryRoot,
    });
    return true;
  }

  logError(`Photo library root is not reachable for ${context}.`, {
    photoLibraryRoot,
    likelyCauses: [
      "NAS path is wrong",
      "Windows credentials are not saved",
      "Mapped drive is unavailable to this process",
      "Network is unavailable",
    ],
  });
  return false;
}
