"use client";

import { useActionState } from "react";
import { recalculateChampionshipAction } from "@/lib/championship/actions";
import { initialSportsActionState } from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

export default function RecalculateForm({
  seasonId,
}: {
  seasonId: number;
}) {
  const [state, action, pending] = useActionState(
    recalculateChampionshipAction,
    initialSportsActionState,
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-2 sm:items-end"
    >
      <input type="hidden" name="seasonId" value={seasonId} />
      <button
        disabled={pending}
        className="wizard-secondary-button"
      >
        {pending ? "Berechnet…" : "Neu berechnen"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
