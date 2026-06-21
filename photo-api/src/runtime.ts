let scanRunning = false;
let activeScanRunId: string | null = null;
let nextScheduledScanAt: string | null = null;

const serverStartedAt = new Date().toISOString();

export function isScanRunning() {
  return scanRunning;
}

export function startScanLock(scanRunId: string) {
  if (scanRunning) {
    return false;
  }

  scanRunning = true;
  activeScanRunId = scanRunId;
  return true;
}

export function endScanLock() {
  scanRunning = false;
  activeScanRunId = null;
}

export function getActiveScanRunId() {
  return activeScanRunId;
}

export function getServerStartedAt() {
  return serverStartedAt;
}

export function getUptimeSeconds() {
  return Math.max(0, Math.floor((Date.now() - Date.parse(serverStartedAt)) / 1000));
}

export function setNextScheduledScanAt(nextRunAt: string | null) {
  nextScheduledScanAt = nextRunAt;
}

export function getNextScheduledScanAt() {
  return nextScheduledScanAt;
}
