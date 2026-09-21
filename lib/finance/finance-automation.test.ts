import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FinanceSettlementStatus } from "@/generated/prisma/client";
import {
  reconcilePublishedResultFinance,
  runDailyFinanceRecovery,
} from "./automation";

const source = (name: string) =>
  readFileSync(new URL(name, import.meta.url), "utf8");

test("published result reconciliation immediately queues changed Discord output", async () => {
  const calls: string[] = [];
  const result = await reconcilePublishedResultFinance(12, 3, {
    reconcile: async (raceId, leagueId) => {
      calls.push(`reconcile:${raceId}:${leagueId}`);
      return {
        processed: true,
        changed: true,
        settlementId: 9,
        revision: 2,
        autoPublish: true,
      };
    },
    queuePublication: async (raceId, leagueId, changed) => {
      calls.push(`discord:${raceId}:${leagueId}:${changed}`);
      return true;
    },
  });

  assert.deepEqual(calls, ["reconcile:12:3", "discord:12:3:true"]);
  assert.equal(result.discordQueued, true);
});

test("unchanged result reconciliation remains idempotent", async () => {
  let queued = false;
  const result = await reconcilePublishedResultFinance(12, 3, {
    reconcile: async () => ({
      processed: true,
      changed: false,
      settlementId: 9,
      revision: 2,
      autoPublish: true,
    }),
    queuePublication: async (_raceId, _leagueId, changed) => {
      queued = changed;
      return false;
    },
  });

  assert.equal(result.changed, false);
  assert.equal(result.discordQueued, false);
  assert.equal(queued, false);
});

test("a published result correction immediately uses the next settlement revision", async () => {
  let revision = 0;
  const queuedRevisions: number[] = [];
  const dependencies = {
    reconcile: async () => {
      revision += 1;
      return {
        processed: true,
        changed: true,
        settlementId: 9,
        revision,
        autoPublish: true,
      };
    },
    queuePublication: async () => {
      queuedRevisions.push(revision);
      return true;
    },
  };

  await reconcilePublishedResultFinance(12, 3, dependencies);
  await reconcilePublishedResultFinance(12, 3, dependencies);

  assert.deepEqual(queuedRevisions, [1, 2]);
});

test("daily recovery skips current settlements and repairs only missing or stale ones", async () => {
  const reconciled: number[] = [];
  const result = await runDailyFinanceRecovery(
    [
      { raceId: 1, leagueId: 1 },
      { raceId: 2, leagueId: 1 },
      { raceId: 3, leagueId: 1 },
    ],
    {
      preview: async (raceId) => ({
        ready: true,
        needsReconciliation: raceId === 3,
        settlement:
          raceId === 2
            ? null
            : { status: FinanceSettlementStatus.SETTLED },
      }),
      reconcile: async (raceId) => {
        reconciled.push(raceId);
        return {
          processed: true,
          changed: true,
          settlementId: raceId,
          revision: 1,
          autoPublish: true,
          discordQueued: raceId === 3,
        };
      },
    },
  );

  assert.deepEqual(reconciled, [2, 3]);
  assert.deepEqual(result, {
    checked: 3,
    candidates: 2,
    reconciled: 2,
    published: 1,
    failed: 0,
  });
});

test("daily recovery retries interrupted settlements", async () => {
  let reconciled = 0;
  const result = await runDailyFinanceRecovery(
    [{ raceId: 4, leagueId: 2 }],
    {
      preview: async () => ({
        ready: true,
        needsReconciliation: false,
        settlement: { status: FinanceSettlementStatus.PENDING },
      }),
      reconcile: async () => {
        reconciled += 1;
        return {
          processed: true,
          changed: false,
          settlementId: 4,
          revision: 1,
          autoPublish: false,
          discordQueued: false,
        };
      },
    },
  );

  assert.equal(reconciled, 1);
  assert.equal(result.candidates, 1);
  assert.equal(result.reconciled, 0);
});

test("all result event entry points use the central finance orchestrator", () => {
  assert.match(
    source("./result-actions.ts"),
    /saveResultsAction[\s\S]+reconcilePublishedResultFinance/,
  );
  assert.match(
    source("../../app/api/internal/webhooks/route.ts"),
    /WebhookEventType\.RaceFinished[\s\S]+reconcilePublishedResultFinance/,
  );
  assert.match(
    source("../../components/championship/ResultsEditor.tsx"),
    /saveResultsWithFinanceAction/,
  );
});

test("finance recovery is daily and never a five-minute reconciliation job", () => {
  const runner = source("../automation/runner.ts");
  assert.match(
    runner,
    /FinanceReconciliation[\s\S]+intervalMinutes: 1440/,
  );
  assert.doesNotMatch(
    runner,
    /FinanceReconciliation[^\n]+intervalMinutes: 5/,
  );
  assert.match(runner, /recoverPublishedRaceFinances/);
});
