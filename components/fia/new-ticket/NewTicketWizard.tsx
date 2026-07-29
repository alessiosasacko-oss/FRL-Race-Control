"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { RaceSession } from "@/domain";
import { createFiaTicketAction } from "@/lib/fia/actions";
import type { VideoEvidenceUploaderHandle } from "@/components/fia/VideoEvidenceUploader";
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

const lastStep = 4;

function canContinue(step: number, data: TicketWizardDraft): boolean {
  switch (step) {
    case 1:
      return Boolean(
        data.leagueId && data.raceId && data.driverIds.length > 0,
      );
    case 2:
      return (
        data.title.trim().length >= 3 &&
        data.description.trim().length >= 10
      );
    case 3:
      return data.evidence.every(
        (evidence) =>
          evidence.kind === "upload" ||
          (evidence.label.trim() !== "" && evidence.url.trim() !== ""),
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
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadResetHandled, setUploadResetHandled] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [submissionKey] = useState(() => crypto.randomUUID());
  const uploaderRef = useRef<VideoEvidenceUploaderHandle>(null);
  const [state, formAction, pending] = useActionState(
    createFiaTicketAction,
    initialFiaActionState,
  );
  const [data, setData] = useState<TicketWizardDraft>({
    leagueId: "",
    raceId: "",
    session: RaceSession.Race,
    driverIds: [],
    title: "",
    description: "",
    lap: "",
    evidence: [],
  });

  function resetFailedUploads(): void {
    setData((previous) => ({
      ...previous,
      evidence: previous.evidence.filter(
        (evidence) => evidence.kind === "external",
      ),
    }));
    setStep(3);
    setMaxStepReached(3);
    setWorkflowMessage(
      "Das Ticket wurde nicht vollständig erstellt. Bitte lade das Video erneut hoch.",
    );
    setUploadResetHandled(true);
  }

  async function goForward(): Promise<void> {
    if (!canContinue(step, data)) return;
    if (step === 3 && uploaderRef.current?.hasPendingFiles()) {
      setUploadPending(true);
      setWorkflowMessage("Video wird hochgeladen …");
      const result = await uploaderRef.current.uploadPending();
      setUploadPending(false);
      if (!result.success) {
        setWorkflowMessage(
          "Die Datei konnte nicht hochgeladen werden. Bitte versuche es erneut.",
        );
        return;
      }
      setData((previous) => ({
        ...previous,
        evidence: [
          ...previous.evidence.filter(
            (evidence) => evidence.kind === "external",
          ),
          ...result.uploads,
        ],
      }));
      setWorkflowMessage("Videobeweis wurde sicher vorbereitet.");
    }
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
          setCurrentStep={(targetStep) => {
            if (uploadPending || pending) return;
            if (step === 3 && targetStep === 4) {
              void goForward();
              return;
            }
            setStep(targetStep);
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="min-h-[34rem] p-5 sm:p-8">
            {step === 1 ? (
              <div className="space-y-10">
                <GeneralStep data={data} options={options} setData={setData} />
                <DriversStep data={data} options={options} setData={setData} />
              </div>
            ) : null}
            {step === 2 ? (
              <IncidentStep data={data} setData={setData} />
            ) : null}
            {step === 3 ? (
              <EvidenceStep
                data={data}
                options={options}
                setData={setData}
                uploaderRef={uploaderRef}
              />
            ) : null}
            {step === 4 ? (
              <ReviewStep data={data} options={options} />
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              {step === 1 ? (
                <Link
                  href="/fia"
                  className="wizard-secondary-button w-full justify-center sm:w-auto"
                >
                  Abbrechen
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="wizard-secondary-button w-full justify-center sm:w-auto"
                >
                  <ArrowLeft size={18} /> Zurück
                </button>
              )}
            </div>

            {step < lastStep ? (
              <button
                type="button"
                onClick={() => void goForward()}
                disabled={!canContinue(step, data) || uploadPending}
                className="wizard-primary-button w-full justify-center sm:w-auto"
              >
                {uploadPending ? "Video wird hochgeladen …" : "Weiter"}
                <ArrowRight size={18} />
              </button>
            ) : (
              <form
                action={formAction}
                onSubmit={() => setUploadResetHandled(false)}
              >
                <input type="hidden" name="leagueId" value={data.leagueId} />
                <input type="hidden" name="raceId" value={data.raceId} />
                <input type="hidden" name="session" value={data.session} />
                <input type="hidden" name="title" value={data.title} />
                <input
                  type="hidden"
                  name="description"
                  value={data.description}
                />
                <input type="hidden" name="lap" value={data.lap} />
                <input
                  type="hidden"
                  name="submissionKey"
                  value={submissionKey}
                />
                <input
                  type="hidden"
                  name="evidence"
                  value={JSON.stringify(data.evidence)}
                />
                {data.driverIds.map((driverId) => (
                  <input
                    key={driverId}
                    type="hidden"
                    name="driverId"
                    value={driverId}
                  />
                ))}
                <button
                  type="submit"
                  disabled={pending}
                  className="wizard-primary-button w-full"
                >
                  <CheckCircle2 size={18} />
                  {pending
                    ? "Ticket und Videobeweis werden verknüpft …"
                    : "Ticket erstellen"}
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
          {workflowMessage ? (
            <p
              role="status"
              className="border-t border-blue-500/20 bg-blue-500/10 px-6 py-4 text-sm text-blue-100"
            >
              {workflowMessage}
            </p>
          ) : null}
          {state.resetUploads && !uploadResetHandled ? (
            <div className="border-t border-amber-500/25 bg-amber-500/10 px-6 py-4 text-sm text-amber-100">
              <p>
                Das Ticket wurde nicht vollständig erstellt. Der
                temporäre Upload wurde sicher bereinigt.
              </p>
              <button
                type="button"
                onClick={resetFailedUploads}
                className="wizard-secondary-button mt-3 min-h-11"
              >
                Video erneut auswählen
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
