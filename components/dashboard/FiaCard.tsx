import { Shield, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FiaCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">

      <div className="mb-5 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-red-600 p-3">
            <Shield size={22} />
          </div>

          <div>
            <h2 className="text-lg font-semibold">
              FIA
            </h2>

            <p className="text-sm text-slate-400">
              Offene Vorfälle
            </p>
          </div>

        </div>

      </div>

      <div className="space-y-4">

        <div className="rounded-xl bg-[#0F141B] p-4">

          <div className="flex justify-between">

            <div>

              <h3 className="font-semibold">
                Ticket #24
              </h3>

              <p className="text-sm text-slate-400">
                Elias vs Fishly
            
              </p>

            </div>

            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400">
              In Bearbeitung
            </span>

          </div>

          <div className="mt-4 flex items-center gap-2 text-slate-400">

            <Clock size={16} />

            Heute 22:00 Uhr

          </div>

        </div>

      </div>

      <Link
        href="/fia"
        className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium transition hover:bg-blue-700"
      >
        FIA öffnen
        <ArrowRight size={18} />
      </Link>

    </div>
  );
}