"use client";

import { AlertTriangle } from "lucide-react";

type MasterDataErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function MasterDataError({
  error,
  unstable_retry,
}: MasterDataErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080B10] p-6 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center shadow-2xl">
        <AlertTriangle className="mx-auto text-red-400" size={38} />
        <h1 className="mt-4 text-2xl font-bold">
          Stammdaten konnten nicht geladen werden
        </h1>
        <p className="mt-3 text-slate-400">
          Bitte versuche es erneut. Fehlerreferenz:{" "}
          {error.digest ?? "nicht verfügbar"}
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="wizard-primary-button mt-6"
        >
          Erneut versuchen
        </button>
      </section>
    </main>
  );
}
