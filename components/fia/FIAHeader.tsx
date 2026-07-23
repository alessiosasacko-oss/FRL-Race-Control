import { Shield, Activity, Bell } from "lucide-react";

export default function FIAHeader() {
  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-[#111827] via-[#162235] to-[#1b3b73]">

      <div className="flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-3">
              <Shield size={28} className="text-white" />
            </div>

            <span className="rounded-full bg-blue-500/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              F1 Realistic League
            </span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white">
            FIA Race Control
          </h1>

          <p className="mt-3 max-w-2xl text-slate-300">
            Verwaltung aller Vorfälle, Untersuchungen und Entscheidungen der
            Stewards innerhalb der Formula Realistic League.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">

          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 backdrop-blur">
            <Activity className="mb-2 text-blue-400" size={24} />
            <p className="text-3xl font-bold text-white">LIVE</p>
            <p className="text-sm text-slate-400">
              Race Control Status
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5 backdrop-blur">
            <Bell className="mb-2 text-yellow-400" size={24} />
            <p className="text-3xl font-bold text-white">12</p>
            <p className="text-sm text-slate-400">
              Offene Meldungen
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}