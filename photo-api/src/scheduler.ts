import { config } from "./config";
import { runScan } from "./indexer";
import { logError, logInfo } from "./logger";
import { setNextScheduledScanAt } from "./runtime";

type SchedulerHandle = {
  stop: () => void;
};

function parseScheduledTime(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

function getTimezoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const read = (type: string) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function findNextScheduledScanAt(timeZone: string, scheduledTime: { hours: number; minutes: number }) {
  const start = Date.now() + 60_000;
  const end = start + 1000 * 60 * 60 * 48;

  for (let timestamp = start; timestamp <= end; timestamp += 60_000) {
    const parts = getTimezoneParts(new Date(timestamp), timeZone);

    if (parts.hour === scheduledTime.hours && parts.minute === scheduledTime.minutes) {
      return new Date(timestamp);
    }
  }

  return null;
}

export function startScheduledScanRunner(): SchedulerHandle | null {
  if (!config.enableScheduledScan) {
    setNextScheduledScanAt(null);
    logInfo("Scheduled photo scan is disabled.");
    return null;
  }

  const parsedTime = parseScheduledTime(config.scheduledScanTime);
  const timeZone = config.scheduledScanTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!parsedTime) {
    setNextScheduledScanAt(null);
    logError("Scheduled photo scan could not start because SCHEDULED_SCAN_TIME is invalid.", {
      scheduledScanTime: config.scheduledScanTime,
    });
    return null;
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) {
      return;
    }

    try {
      const nextRun = findNextScheduledScanAt(timeZone, parsedTime);

      if (!nextRun) {
        setNextScheduledScanAt(null);
        logError("Scheduled photo scan could not compute the next run time.", {
          scheduledScanTime: config.scheduledScanTime,
          scheduledScanTimezone: timeZone,
        });
        return;
      }

      setNextScheduledScanAt(nextRun.toISOString());
      const delay = Math.max(1000, nextRun.getTime() - Date.now());

      logInfo("Next scheduled photo scan planned.", {
        scheduledScanTime: config.scheduledScanTime,
        scheduledScanTimezone: timeZone,
        nextScheduledScanAt: nextRun.toISOString(),
      });

      timeout = setTimeout(() => {
        timeout = null;

        void runScan("incremental")
          .then((result) => {
            logInfo("Scheduled photo scan completed.", {
              scanRunId: result.scanRunId,
              mode: result.mode,
              ...result.summary,
            });
          })
          .catch((error) => {
            logError("Scheduled photo scan failed.", {
              error: error instanceof Error ? error.message : String(error),
            });
          })
          .finally(() => {
            scheduleNext();
          });
      }, delay);
    } catch (error) {
      setNextScheduledScanAt(null);
      logError("Scheduled photo scan setup failed.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  scheduleNext();

  return {
    stop() {
      stopped = true;
      setNextScheduledScanAt(null);
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  };
}
