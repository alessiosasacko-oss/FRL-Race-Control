import { ListOrdered } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";
import DashboardCard from "./DashboardCard";
import CountryFlag from "@/components/ui/CountryFlag";

export default function RankingsWidget({
  championship,
}: {
  championship: DashboardData["championship"];
}) {
  return (
    <DashboardCard
      icon={ListOrdered}
      title="Top 5"
      className="xl:col-span-2"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
            Fahrer
          </h3>
          <div className="space-y-2">
            {championship.topDrivers.map((driver) => (
              <div
                key={`${driver.position}-${driver.name}`}
                className="flex items-center gap-3 rounded-xl bg-slate-950/35 px-4 py-3"
              >
                <span className="w-7 font-mono font-bold text-blue-400">
                  {driver.position}
                </span>
                <CountryFlag countryCode={null} fallbackFlag={driver.flag} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {driver.name}
                </span>
                <span className="text-sm font-bold text-white">
                  {driver.points}
                </span>
              </div>
            ))}
            {championship.topDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Noch keine Fahrerwertung.
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
            Teams
          </h3>
          <div className="space-y-2">
            {championship.topTeams.map((team) => (
              <div
                key={`${team.position}-${team.name}`}
                className="flex items-center gap-3 rounded-xl bg-slate-950/35 px-4 py-3"
              >
                <span className="w-7 font-mono font-bold text-blue-400">
                  {team.position}
                </span>
                <span
                  className="h-7 w-1 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {team.name}
                </span>
                <span className="text-sm font-bold text-white">
                  {team.points}
                </span>
              </div>
            ))}
            {championship.topTeams.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Noch keine Teamwertung.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
