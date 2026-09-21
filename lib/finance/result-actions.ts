"use server";

import { revalidatePath } from "next/cache";
import { saveResultsAction } from "@/lib/championship/result-actions";
import type { SportsActionState } from "@/lib/championship/types";
import { logger } from "@/lib/observability/logger";
import { reconcilePublishedResultFinance } from "./automation";

function publishedResultContext(formData: FormData): {
  raceId: number;
  leagueId: number;
} | null {
  if (formData.get("intent") !== "PUBLISH") return null;
  const rawSubmission = formData.get("submission");
  if (typeof rawSubmission !== "string") return null;
  try {
    const submission = JSON.parse(rawSubmission) as {
      raceId?: unknown;
      leagueId?: unknown;
    };
    const raceId = Number(submission.raceId);
    const leagueId = Number(submission.leagueId);
    if (!Number.isInteger(raceId) || raceId <= 0) return null;
    if (!Number.isInteger(leagueId) || leagueId <= 0) return null;
    return { raceId, leagueId };
  } catch {
    return null;
  }
}

/** Runs finance only after the result action has completed its database commit. */
export async function saveResultsWithFinanceAction(
  previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const state = await saveResultsAction(previousState, formData);
  const context = publishedResultContext(formData);
  if (state.status !== "success" || !state.persisted || !context) return state;

  try {
    const result = await reconcilePublishedResultFinance(
      context.raceId,
      context.leagueId,
    );
    if (result.processed) {
      revalidatePath("/admin/finance");
      revalidatePath("/finance");
      revalidatePath("/dashboard");
    }
  } catch (error: unknown) {
    // Result publishing has already committed. Daily recovery safely retries finance.
    logger.error("Immediate result finance reconciliation failed", error, context);
  }

  return state;
}
