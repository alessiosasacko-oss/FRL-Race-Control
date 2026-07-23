"use client";

import {
  CheckCircle2,
  ClipboardList,
  Flag,
  FileSearch,
  Gavel,
  Shield,
} from "lucide-react";

type Props = {
  currentStep: number;
  setCurrentStep: (step: number) => void;
};

const steps = [
  {
    id: 1,
    title: "Allgemein",
    icon: Shield,
  },
  {
    id: 2,
    title: "Fahrer",
    icon: Flag,
  },
  {
    id: 3,
    title: "Vorfall",
    icon: ClipboardList,
  },
  {
    id: 4,
    title: "Beweise",
    icon: FileSearch,
  },
  {
    id: 5,
    title: "Entscheidung",
    icon: Gavel,
  },
  {
    id: 6,
    title: "Übersicht",
    icon: CheckCircle2,
  },
];

export default function StepSidebar({
  currentStep,
  setCurrentStep,
}: Props) {
  return (
    <aside className="w-72 border-r border-slate-800 bg-[#11161F] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">
        FIA RACE CONTROL
      </p>

      <h2 className="mt-2 text-2xl font-bold text-white">
        Neues Ticket
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Erstelle eine neue Untersuchung.
      </p>

      <div className="mt-10 space-y-2">
        {steps.map((step) => {
          const Icon = step.icon;

          const active = currentStep === step.id;
          const completed = currentStep > step.id;

          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition ${
                active
                  ? "bg-blue-600 text-white"
                  : completed
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
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
                <p className="text-sm font-semibold">
                  {step.title}
                </p>

                <p className="text-xs opacity-70">
                  Schritt {step.id}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}