import { Gauge } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardCard from "./DashboardCard";

export default function SeasonProgressWidget({
  progress,
}: {
  progress: DashboardData["seasonProgress"];
}) {
  const percentage =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <DashboardCard icon={Gauge} title="Saisonfortschritt">
      {progress ? (
        <div>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-white">{percentage}%</p>
            <p className="text-sm text-slate-400">
              {progress.completed} / {progress.total} Rennen
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-slate-400">
          Keine aktive Saison.
        </p>
      )}
    </DashboardCard>
  );
}
