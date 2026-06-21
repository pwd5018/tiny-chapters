type LoggerMeta = Record<string, unknown> | undefined;

function log(level: "INFO" | "WARN" | "ERROR", message: string, meta?: LoggerMeta) {
  const timestamp = new Date().toISOString();
  const formattedMeta = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${timestamp}] [${level}] ${message}${formattedMeta}`);
}

export function logInfo(message: string, meta?: LoggerMeta) {
  log("INFO", message, meta);
}

export function logWarn(message: string, meta?: LoggerMeta) {
  log("WARN", message, meta);
}

export function logError(message: string, meta?: LoggerMeta) {
  log("ERROR", message, meta);
}
