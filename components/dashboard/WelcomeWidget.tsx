import Image from "next/image";
import { UserRound } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/types";

export default function WelcomeWidget({
  identity,
}: {
  identity: DashboardData["identity"];
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-600/20 via-[#151B24] to-[#151B24] p-6 sm:p-8">
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {identity.avatarUrl ? (
          <Image
            src={identity.avatarUrl}
            alt=""
            width={80}
            height={80}
            className="size-20 rounded-2xl border border-blue-400/30 object-cover"
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <UserRound size={34} />
          </span>
        )}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Willkommen zurück
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {identity.driver?.flag}{" "}
            {identity.driver?.name ?? identity.displayName}
          </h1>
          <p className="mt-3 text-slate-300">
            {identity.driver
              ? `#${identity.driver.number} · ${
                  identity.driver.team?.name ?? "Ohne Team"
                } · ${identity.driver.league.code} · ${
                  identity.season?.name ?? "Keine Saison"
                }`
              : "Noch kein Fahrerprofil zugeordnet"}
          </p>
        </div>
      </div>
    </section>
  );
}
