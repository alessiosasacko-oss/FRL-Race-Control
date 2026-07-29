"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Gavel } from "lucide-react";
import {
  DecisionOutcome,
  PenaltyType,
  TicketStatus,
  decisionOutcomeLabels,
  penaltyTypeLabels,
} from "@/domain";
import { finalizeFiaTicketAction } from "@/lib/fia/proposal-actions";
import {
  initialFiaActionState,
  type FiaTicketDetail,
} from "@/lib/fia/types";
import ActionMessage from "./ActionMessage";

type DecisionCardProps = {
  ticketId: number;
  status: FiaTicketDetail["status"];
  decision: FiaTicketDetail["decision"];
  drivers: FiaTicketDetail["drivers"];
  proposals: Array<
    NonNullable<
      FiaTicketDetail["discussionMessages"][number]["proposal"]
    >
  >;
  canFinalize: boolean;
  readOnly?: boolean;
};

const penaltyChoices = [
  PenaltyType.Warning,
  PenaltyType.Reprimand,
  PenaltyType.TimePenalty,
  PenaltyType.PenaltyPoints,
  PenaltyType.QualifyingBan,
  PenaltyType.RaceBan,
  PenaltyType.SeasonBan,
  PenaltyType.DriveThrough,
  PenaltyType.StopAndGo,
  PenaltyType.Disqualification,
  PenaltyType.PointsDeduction,
] as const;

const valuePenalties = new Set<PenaltyType>([
  PenaltyType.TimePenalty,
  PenaltyType.PenaltyPoints,
  PenaltyType.PointsDeduction,
]);

function formatPenalty(
  penaltyType: PenaltyType,
  penaltyValue: number | null,
): string {
  if (penaltyType === PenaltyType.TimePenalty && penaltyValue !== null) {
    return `+${penaltyValue} Sekunden`;
  }
  if (penaltyType === PenaltyType.PenaltyPoints && penaltyValue !== null) {
    return `${penaltyValue} Strafpunkte`;
  }
  if (penaltyType === PenaltyType.PointsDeduction && penaltyValue !== null) {
    return `-${penaltyValue} Meisterschaftspunkte`;
  }
  return penaltyTypeLabels[penaltyType];
}

export default function DecisionCard({
  ticketId,
  status,
  decision,
  drivers,
  proposals,
  canFinalize,
  readOnly = false,
}: DecisionCardProps) {
  const [outcome, setOutcome] = useState<DecisionOutcome>(
    DecisionOutcome.NoFurtherInvestigation,
  );
  const [selectedPenalties, setSelectedPenalties] = useState<
    Set<PenaltyType>
  >(new Set());
  const action = finalizeFiaTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(
    action,
    initialFiaActionState,
  );
  const openProposalCount = proposals.filter(
    (proposal) => proposal.status === "OPEN",
  ).length;
  const closedProposals = proposals.filter(
    (proposal) => proposal.status !== "OPEN",
  );

  function togglePenalty(penaltyType: PenaltyType): void {
    setSelectedPenalties((current) => {
      const next = new Set(current);
      if (next.has(penaltyType)) next.delete(penaltyType);
      else next.add(penaltyType);
      return next;
    });
  }

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
            {decisionOutcomeLabels[decision.outcome]}
          </p>
          {decision.penalties.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {decision.penalties.map((penalty) => (
                <li
                  key={penalty.penaltyType}
                  className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-100"
                >
                  {formatPenalty(
                    penalty.penaltyType,
                    penalty.penaltyValue,
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {decision.affectedDriver ? (
            <p className="mt-3 text-sm font-medium text-slate-300">
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
      ) : canFinalize &&
        !readOnly &&
        status === TicketStatus.InReview ? (
        <form action={formAction} className="mt-5 space-y-5">
          <p className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
            Ein berechtigter Steward schließt das Ticket mit dieser
            unveränderlichen, offiziellen Entscheidung ab.
          </p>

          <label className="block">
            <span className="form-label">Entscheidung</span>
            <select
              name="outcome"
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as DecisionOutcome)
              }
              className="form-control"
            >
              {Object.values(DecisionOutcome).map((value) => (
                <option key={value} value={value}>
                  {decisionOutcomeLabels[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="form-label">Betroffener Fahrer</span>
            <select name="affectedDriverId" className="form-control">
              <option value="">Kein Fahrer / nicht erforderlich</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  #{driver.number} · {driver.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="form-label">
              Strafkomponenten (optional, bei „Strafe“ erforderlich)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {penaltyChoices.map((penaltyType) => {
                const selected = selectedPenalties.has(penaltyType);
                return (
                  <div
                    key={penaltyType}
                    className={`rounded-xl border p-3 ${
                      selected
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-slate-700 bg-slate-950/30"
                    }`}
                  >
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-100">
                      <input
                        type="checkbox"
                        name="penaltyType"
                        value={penaltyType}
                        checked={selected}
                        onChange={() => togglePenalty(penaltyType)}
                      />
                      {penaltyTypeLabels[penaltyType]}
                    </label>
                    {selected && valuePenalties.has(penaltyType) ? (
                      <input
                        name={`penaltyValue_${penaltyType}`}
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        placeholder={
                          penaltyType === PenaltyType.TimePenalty
                            ? "Sekunden"
                            : "Wert"
                        }
                        className="form-control mt-2"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {closedProposals.length > 0 ? (
            <label className="block">
              <span className="form-label">
                Verknüpfter Abstimmungsvorschlag
              </span>
              <select name="proposalId" className="form-control">
                <option value="">Kein Vorschlag verknüpfen</option>
                {closedProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    #{proposal.id} · {proposal.affectedDriver.name} ·{" "}
                    {penaltyTypeLabels[proposal.penaltyType]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="form-label">Begründung</span>
            <textarea
              name="reason"
              rows={5}
              required
              minLength={5}
              maxLength={5000}
              className="form-control"
              placeholder="Verbindliche Entscheidungsbegründung…"
            />
          </label>

          <label className="block">
            <span className="form-label">Interne Notiz (optional)</span>
            <textarea
              name="internalNote"
              rows={3}
              maxLength={5000}
              className="form-control"
            />
          </label>

          {openProposalCount > 0 ? (
            <label className="flex gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-100">
              <input
                name="confirmOpenVotes"
                type="checkbox"
                className="mt-1"
              />
              <span>
                <strong className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {openProposalCount} offene Abstimmung(en)
                </strong>
                Ich bestätige, dass sie beim Ticketabschluss nachvollziehbar
                beendet werden.
              </span>
            </label>
          ) : null}

          <ActionMessage state={state} />
          <button
            type="submit"
            disabled={pending}
            className="wizard-primary-button w-full sm:w-auto"
          >
            {pending ? "Schließt ab…" : "Ticket abschließen"}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-slate-400">
          Noch keine finale Entscheidung veröffentlicht.
        </p>
      )}
    </section>
  );
}
