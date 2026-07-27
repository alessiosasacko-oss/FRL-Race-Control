"use client";

import { useActionState } from "react";
import { Gavel } from "lucide-react";
import {
  PenaltyType,
  TicketStatus,
  penaltyTypeLabels,
} from "@/domain";
import { publishFiaDecisionAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import ActionMessage from "./ActionMessage";

type DecisionCardProps = {
  ticketId: number;
  status: FiaTicketDetail["status"];
  decision: FiaTicketDetail["decision"];
  voteCount: number;
  canDecide: boolean;
  canUseLegacyDecision: boolean;
};

export default function DecisionCard({
  ticketId,
  status,
  decision,
  voteCount,
  canDecide,
  canUseLegacyDecision,
}: DecisionCardProps) {
  const action = publishFiaDecisionAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Gavel className="text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-white">
          Finale Entscheidung
        </h2>
      </div>

      {decision ? (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-5">
          <p className="text-lg font-semibold text-green-200">
            {penaltyTypeLabels[decision.penaltyType]}
            {decision.penaltyValue !== null
              ? ` · ${decision.penaltyValue}`
              : ""}
          </p>
          {decision.affectedDriver ? (
            <p className="mt-2 text-sm font-medium text-slate-300">
              Fahrer: {decision.affectedDriver.name} · #
              {decision.affectedDriver.number}
            </p>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-200">
            {decision.reason}
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Veröffentlicht am{" "}
            {new Intl.DateTimeFormat("de-DE", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(decision.decidedAt))}
            {decision.stewards.length > 0
              ? ` · Beteiligte Stewards: ${decision.stewards
                  .map((steward) => steward.displayName)
                  .join(", ")}`
              : ""}
          </p>
        </div>
      ) : canDecide &&
        canUseLegacyDecision &&
        status === TicketStatus.InReview ? (
        <form action={formAction} className="mt-5 space-y-3">
          <p className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">
            Nur der FIA-Präsident oder eine Rolle mit Entscheidungsrecht kann
            diese finale, danach unveränderliche Entscheidung veröffentlichen.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              name="penaltyType"
              defaultValue={PenaltyType.NoFurtherAction}
              className="form-control"
            >
              {Object.values(PenaltyType).map((penalty) => (
                <option key={penalty} value={penalty}>
                  {penaltyTypeLabels[penalty]}
                </option>
              ))}
            </select>
            <input
              name="penaltyValue"
              type="number"
              min={0}
              step="0.01"
              placeholder="Wert (optional)"
              className="form-control"
            />
          </div>
          <textarea
            name="reason"
            rows={5}
            required
            maxLength={5000}
            placeholder="Verbindliche Entscheidungsbegründung…"
            className="form-control"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {state.message ? (
                <ActionMessage state={state} />
              ) : (
                <p className="text-sm text-slate-500">
                  {voteCount} Steward-Bewertung(en) vorhanden
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={pending || voteCount === 0}
              className="wizard-primary-button"
            >
              {pending ? "Veröffentlicht…" : "Entscheidung veröffentlichen"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-5 text-slate-400">
          Noch keine finale Entscheidung veröffentlicht.
        </p>
      )}
    </section>
  );
}
