"use client";

import {
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Shield,
} from "lucide-react";

type StepSidebarProps = {
  currentStep: number;
  maxStepReached: number;
  setCurrentStep: (step: number) => void;
};

const steps = [
  { id: 1, title: "Rennen & Fahrer", icon: Shield },
  { id: 2, title: "Vorfall", icon: ClipboardList },
  { id: 3, title: "Beweise", icon: FileSearch },
  { id: 4, title: "Übersicht", icon: CheckCircle2 },
];

export default function StepSidebar({
  currentStep,
  maxStepReached,
  setCurrentStep,
}: StepSidebarProps) {
  return (
    <aside className="border-b border-slate-800 bg-[#11161F] p-4 lg:w-72 lg:border-b-0 lg:border-r lg:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
        FIA Race Control
      </p>
      <h2 className="mt-2 text-2xl font-bold text-white">Neues Ticket</h2>
      <p className="mt-2 text-sm text-slate-400">
        Erstelle eine neue Untersuchung.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-10 lg:grid-cols-1">
        {steps.map((step) => {
          const Icon = step.icon;
          const active = currentStep === step.id;
          const completed = currentStep > step.id;
          const disabled = step.id > maxStepReached;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              disabled={disabled}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left transition lg:gap-4 lg:px-4 lg:py-4 ${
                active
                  ? "bg-blue-600 text-white"
                  : completed
                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    : disabled
                      ? "cursor-not-allowed text-slate-600"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div
                className={`hidden h-10 w-10 items-center justify-center rounded-lg sm:flex ${
                  active
                    ? "bg-white/20"
                    : completed
                      ? "bg-green-500/20"
                      : "bg-slate-800"
                }`}
              >
                <Icon size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs opacity-70">Schritt {step.id} von 4</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
