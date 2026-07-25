import "dotenv/config";
import { runDueAutomationJobs } from "../lib/automation/runner";
import {
  getConnectedDiscordClient,
  stopDiscordClient,
} from "../lib/discord/client";
import { logger } from "../lib/observability/logger";

const workerIntervalMs = 60_000;
let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runDueAutomationJobs();
  } catch (error: unknown) {
    logger.error("Discord automation worker tick failed", error);
  } finally {
    running = false;
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info("Discord automation worker shutting down", { signal });
  clearInterval(timer);
  await stopDiscordClient();
  process.exit(0);
}

await getConnectedDiscordClient();
await tick();
const timer = setInterval(() => void tick(), workerIntervalMs);

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (error) =>
  logger.error("Unhandled Discord worker rejection", error),
);
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Discord worker exception", error);
  void shutdown("uncaughtException");
});
