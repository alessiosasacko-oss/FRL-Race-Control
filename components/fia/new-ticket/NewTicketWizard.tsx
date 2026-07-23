"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  RaceSession,
  TicketPriority,
} from "@/domain";
import { createFiaTicketAction } from "@/lib/fia/actions";
import {
  initialFiaActionState,
  type TicketWizardOptions,
} from "@/lib/fia/types";
import DriversStep from "./DriversStep";
import EvidenceStep from "./EvidenceStep";
import GeneralStep from "./GeneralStep";
import IncidentStep from "./IncidentStep";
import ReviewStep from "./ReviewStep";
import StepSidebar from "./StepSidebar";
import type { TicketWizardDraft } from "./wizard-types";

const lastStep = 5;

function canContinue(step: number, data: TicketWizardDraft): boolean {
  switch (step) {
    case 1:
      return Boolean(data.leagueId && data.seasonId && data.raceId);
    case 2:
      return data.driverIds.length > 0;
    case 3:
      return (
        data.title.trim().length >= 3 &&
        data.description.trim().length >= 10
      );
    case 4:
      return data.evidence.every(
        (evidence) =>
          evidence.label.trim() !== "" && evidence.url.trim() !== "",
      );
    default:
      return true;
  }
}

type NewTicketWizardProps = {
  options: TicketWizardOptions;
};

export default function NewTicketWizard({
  options,
}: NewTicketWizardProps) {
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [state, formAction, pending] = useActionState(
    createFiaTicketAction,
    initialFiaActionState,
  );
  const [data, setData] = useState<TicketWizardDraft>({
    leagueId: "",
    seasonId: "",
    raceId: "",
    session: RaceSession.Race,
    driverIds: [],
    title: "",
    description: "",
    lap: "",
    corner: "",
    priority: TicketPriority.Normal,
    evidence: [],
  });

  function goForward(): void {
    if (!canContinue(step, data)) return;
    const nextStep = Math.min(lastStep, step + 1);
    setStep(nextStep);
    setMaxStepReached((current) => Math.max(current, nextStep));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#151B24]">
      <div className="lg:flex">
        <StepSidebar
          currentStep={step}
          maxStepReached={maxStepReached}
          setCurrentStep={setStep}
        />

        <div className="min-w-0 flex-1">
          <div className="min-h-[34rem] p-5 sm:p-8">
            {step === 1 ? (
              <GeneralStep data={data} options={options} setData={setData} />
            ) : null}
            {step === 2 ? (
              <DriversStep data={data} options={options} setData={setData} />
            ) : null}
            {step === 3 ? (
              <IncidentStep data={data} setData={setData} />
            ) : null}
            {step === 4 ? (
              <EvidenceStep data={data} setData={setData} />
            ) : null}
            {step === 5 ? (
              <ReviewStep data={data} options={options} />
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              {step === 1 ? (
                <Link href="/fia" className="wizard-secondary-button">
                  Abbrechen
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="wizard-secondary-button"
                >
                  <ArrowLeft size={18} /> Zurück
                </button>
              )}
            </div>

            {step < lastStep ? (
              <button
                type="button"
                onClick={goForward}
                disabled={!canContinue(step, data)}
                className="wizard-primary-button"
              >
                Weiter <ArrowRight size={18} />
              </button>
            ) : (
              <form action={formAction}>
                <input type="hidden" name="leagueId" value={data.leagueId} />
                <input type="hidden" name="seasonId" value={data.seasonId} />
                <input type="hidden" name="raceId" value={data.raceId} />
                <input type="hidden" name="session" value={data.session} />
                <input type="hidden" name="title" value={data.title} />
                <input
                  type="hidden"
                  name="description"
                  value={data.description}
                />
                <input type="hidden" name="lap" value={data.lap} />
                <input type="hidden" name="corner" value={data.corner} />
                <input
                  type="hidden"
                  name="priority"
                  value={data.priority}
                />
                {data.driverIds.map((driverId) => (
                  <input
                    key={driverId}
                    type="hidden"
                    name="driverId"
                    value={driverId}
                  />
                ))}
                {data.evidence.map((evidence) => (
                  <span key={evidence.key}>
                    <input
                      type="hidden"
                      name="evidenceType"
                      value={evidence.type}
                    />
                    <input
                      type="hidden"
                      name="evidenceUrl"
                      value={evidence.url}
                    />
                    <input
                      type="hidden"
                      name="evidenceLabel"
                      value={evidence.label}
                    />
                  </span>
                ))}
                <button
                  type="submit"
                  disabled={pending}
                  className="wizard-primary-button w-full"
                >
                  <CheckCircle2 size={18} />
                  {pending ? "Wird erstellt…" : "Ticket erstellen"}
                </button>
              </form>
            )}
          </div>

          {state.message ? (
            <p
              role="alert"
              className="border-t border-red-500/20 bg-red-500/10 px-6 py-4 text-sm text-red-200"
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
