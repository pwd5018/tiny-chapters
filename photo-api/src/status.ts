import { markInterruptedScanRuns } from "./db";
import { getStatusPayload } from "./statusService";
markInterruptedScanRuns();

async function main() {
  const status = await getStatusPayload();
  console.log(JSON.stringify(status, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
