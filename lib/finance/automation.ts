import "server-only";

import { FinanceSettlementStatus } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import { queueAutomaticFinancePublication } from "./discord";
import {
  previewRaceFinance,
  reconcileAutomaticallyConfiguredRace,
} from "./reconciliation";

export type FinanceRaceContext = {
  raceId: number;
  leagueId: number;
};

type AutomaticReconciliationResult = {
  processed: boolean;
  changed: boolean;
  settlementId?: number;
  revision?: number;
  autoPublish?: boolean;
};

type PublishedResultDependencies = {
  reconcile: (
    raceId: number,
    leagueId: number,
  ) => Promise<AutomaticReconciliationResult>;
  queuePublication: (
    raceId: number,
    leagueId: number,
    changed: boolean,
  ) => Promise<boolean>;
};

const publishedResultDependencies: PublishedResultDependencies = {
  reconcile: reconcileAutomaticallyConfiguredRace,
  queuePublication: queueAutomaticFinancePublication,
};

/**
 * Single event-driven entry point for final result publications and corrections.
 * Reconciliation commits before an optional Discord outbox item is queued.
 */
export async function reconcilePublishedResultFinance(
  raceId: number,
  leagueId: number,
  dependencies: PublishedResultDependencies = publishedResultDependencies,
) {
  const result = await dependencies.reconcile(raceId, leagueId);
  if (!result.processed) {
    return { ...result, discordQueued: false };
  }
  const discordQueued = await dependencies.queuePublication(
    raceId,
    leagueId,
    result.changed,
  );
  return { ...result, discordQueued };
}

type RecoveryPreview = {
  ready: boolean;
  needsReconciliation: boolean;
  settlement: {
    status: FinanceSettlementStatus;
  } | null;
};

type FinanceRecoveryDependencies = {
  preview: (raceId: number, leagueId: number) => Promise<RecoveryPreview>;
  reconcile: (
    raceId: number,
    leagueId: number,
  ) => Promise<Awaited<ReturnType<typeof reconcilePublishedResultFinance>>>;
  onError?: (context: FinanceRaceContext, error: unknown) => void;
};

export type FinanceRecoveryResult = {
  checked: number;
  candidates: number;
  reconciled: number;
  published: number;
  failed: number;
};

export function needsFinanceRecovery(preview: RecoveryPreview): boolean {
  return (
    preview.ready &&
    (preview.settlement === null ||
      preview.settlement.status !== FinanceSettlementStatus.SETTLED ||
      preview.needsReconciliation)
  );
}

/**
 * Daily safety net. Previewing detects stale hashes without writing; only missing,
 * interrupted, or stale settlements enter the idempotent reconciliation path.
 */
export async function runDailyFinanceRecovery(
  contexts: readonly FinanceRaceContext[],
  dependencies: FinanceRecoveryDependencies,
): Promise<FinanceRecoveryResult> {
  const result: FinanceRecoveryResult = {
    checked: 0,
    candidates: 0,
    reconciled: 0,
    published: 0,
    failed: 0,
  };

  for (const context of contexts) {
    result.checked += 1;
    try {
      const preview = await dependencies.preview(
        context.raceId,
        context.leagueId,
      );
      if (!needsFinanceRecovery(preview)) continue;
      result.candidates += 1;
      const reconciliation = await dependencies.reconcile(
        context.raceId,
        context.leagueId,
      );
      if (reconciliation.processed && reconciliation.changed) {
        result.reconciled += 1;
      }
      if (reconciliation.discordQueued) result.published += 1;
    } catch (error: unknown) {
      result.failed += 1;
      dependencies.onError?.(context, error);
    }
  }

  return result;
}

export async function recoverPublishedRaceFinances(): Promise<FinanceRecoveryResult> {
  const prisma = getPrismaClient();
  const settings = await prisma.financePublishSetting.findMany({
    where: { autoReconcile: true },
    select: { leagueId: true },
  });
  if (settings.length === 0) {
    return {
      checked: 0,
      candidates: 0,
      reconciled: 0,
      published: 0,
      failed: 0,
    };
  }

  const contexts = await prisma.raceResultSession.findMany({
    where: {
      leagueId: { in: settings.map((setting) => setting.leagueId) },
      session: "RACE",
      publicationStatus: "PUBLISHED",
    },
    distinct: ["raceId", "leagueId"],
    orderBy: [{ raceId: "asc" }, { leagueId: "asc" }],
    select: { raceId: true, leagueId: true },
  });

  return runDailyFinanceRecovery(contexts, {
    preview: previewRaceFinance,
    reconcile: reconcilePublishedResultFinance,
    onError: (context, error) =>
      logger.error("Daily finance recovery failed", error, context),
  });
}
