import Image from "next/image";
import { Gauge, Medal, UserRound } from "lucide-react";
import CountryFlag from "@/components/ui/CountryFlag";
import type { DashboardData } from "@/lib/dashboard/types";

export default function DriverHero({ data }: { data: DashboardData }) {
  const driver = data.identity.driver;
  const standing = data.championship.driver;
  const firstName = (driver?.name ?? data.identity.displayName).trim().split(/\s+/)[0] || "Fahrer";
  const teamColor = driver?.team?.color ?? "#2563eb";

  return (
    <section
      className="relative isolate min-h-[22rem] overflow-hidden rounded-[1.75rem] border border-blue-400/20 bg-slate-950 p-5 shadow-[var(--shadow-card)] sm:p-8 lg:min-h-[25rem] lg:p-10"
      style={{ backgroundImage: `radial-gradient(circle at 86% 20%, ${teamColor}55, transparent 32%), linear-gradient(120deg, #07101f 0%, #0c1830 58%, ${teamColor}28 100%)` }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_0_70%,rgba(255,255,255,0.035)_70%_71%,transparent_71%_100%)]" />
      <div className="relative z-10 max-w-full pb-52 sm:pb-56 lg:max-w-[58%] lg:pb-0">
        <p className="eyebrow">Persönliche Rennzentrale</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">Willkommen, {firstName}</h1>
        {driver ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">#{driver.number}</span>
              <CountryFlag countryCode={null} fallbackFlag={driver.flag} size="sm" />
              <span>{driver.league.code}</span>
              <span aria-hidden="true">·</span>
              <span>{driver.team?.name ?? "Ohne Team"}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">Aktiver FRL-Fahrer {data.identity.season ? `· ${data.identity.season.name}` : ""}</p>
          </>
        ) : (
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Noch kein Fahrerprofil zugeordnet. Dein Dashboard bleibt trotzdem vollständig nutzbar.</p>
        )}
        <div className="mt-7 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          <HeroMetric label="WM-Position" value={standing ? `P${standing.position}` : "–"} gold={standing?.position === 1} />
          <HeroMetric label="Punkte" value={standing ? standing.points : "–"} />
          <HeroMetric label="Rückstand" value={standing ? (standing.gapToLeader === 0 ? "WM-FÜHRENDER" : `${standing.gapToLeader} Pkt.`) : "Keine Wertung"} />
        </div>
      </div>

      <div className="absolute bottom-0 right-0 flex h-52 w-full items-end justify-end pr-4 sm:h-60 sm:pr-8 lg:right-8 lg:h-[88%] lg:w-[38%] lg:justify-center lg:pr-0">
        <div className="absolute bottom-4 size-40 rounded-full blur-3xl sm:size-56" style={{ backgroundColor: `${teamColor}44` }} />
        {data.identity.avatarUrl ? (
          <Image src={data.identity.avatarUrl} alt={`Profilbild von ${driver?.name ?? data.identity.displayName}`} width={320} height={320} className="relative mb-8 size-36 rounded-[2rem] border border-white/15 object-cover shadow-2xl sm:size-48 lg:size-64" />
        ) : (
          <div className="relative mb-8 flex size-36 items-center justify-center rounded-[2rem] border border-white/15 bg-slate-900/80 text-blue-200 shadow-2xl sm:size-48 lg:size-64">
            <UserRound className="size-20 sm:size-28 lg:size-36" strokeWidth={1.25} />
          </div>
        )}
      </div>
      <div className="absolute bottom-5 right-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-3 py-2 text-xs font-semibold text-slate-300 backdrop-blur sm:right-8">
        {standing?.position === 1 ? <Medal size={15} className="text-amber-300" /> : <Gauge size={15} className="text-cyan-300" />}
        {standing?.position === 1 ? "WM-FÜHRENDER" : standing ? `Aktuell P${standing.position}` : "Noch keine WM-Platzierung"}
      </div>
    </section>
  );
}

function HeroMetric({ label, value, gold = false }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-black/20 p-3 backdrop-blur ${gold ? "border-amber-400/40" : "border-white/10"}`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${gold ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}
