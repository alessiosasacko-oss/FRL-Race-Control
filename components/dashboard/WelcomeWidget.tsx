import Image from "next/image";
import { Gauge, UserRound } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";

export default function WelcomeWidget({
  identity,
}: {
  identity: DashboardData["identity"];
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow">Persönliche Rennzentrale</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          Willkommen, {identity.driver?.name ?? identity.displayName}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Nächstes Rennen, Fahrerstatus und aktuelle Liga-Aktivität auf einen Blick.
        </p>
      </div>
      <div className="surface-panel flex items-center gap-3 rounded-2xl p-3 pr-5">
        {identity.avatarUrl ? (
          <Image
            src={identity.avatarUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-xl object-cover"
          />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-xl bg-blue-600 text-white">
            <UserRound size={22} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {identity.driver
              ? `${identity.driver.flag} #${identity.driver.number} ${identity.driver.name}`
              : identity.displayName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
            <Gauge size={13} className="text-cyan-400" />
            {identity.driver
              ? `${identity.driver.team?.name ?? "Ohne Team"} · ${identity.driver.league.code}`
              : "Noch kein Fahrerprofil"}
            {identity.season ? ` · ${identity.season.name}` : ""}
          </p>
        </div>
      </div>
    </header>
  );
}
