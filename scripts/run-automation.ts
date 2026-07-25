import "dotenv/config";
import { runDueAutomationJobs } from "../lib/automation/runner";
import { logger } from "../lib/observability/logger";

try {
  const result = await runDueAutomationJobs();
  logger.info("Automation run completed", result);
} catch (error: unknown) {
  logger.error("Automation run failed", error);
  process.exitCode = 1;
}
