import { markInterruptedScanRuns } from "./db";
import { runScan, getScanRunningState } from "./indexer";
markInterruptedScanRuns();

async function main() {
  if (getScanRunningState()) {
    console.error("A scan is already running.");
    process.exitCode = 1;
    return;
  }

  const result = await runScan("incremental");
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
