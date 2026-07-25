import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BellRing,
  CalendarCheck,
  Crown,
  Flag,
  Gauge,
  Medal,
  Settings,
  ShieldAlert,
  Trophy,
  UserRound,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { roleLabels } from "@/domain";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getProfileData } from "@/lib/profile/queries";

const statConfig = [
  { key: "races", label: "Rennen", icon: Flag },
  { key: "wins", label: "Siege", icon: Trophy },
  { key: "podiums", label: "Podien", icon: Medal },
  { key: "poles", label: "Pole Positions", icon: Gauge },
  { key: "fastestLaps", label: "Schnellste Runden", icon: Award },
  { key: "championships", label: "Meisterschaften", icon: Crown },
  {
    key: "attendancePercentage",
    label: "Teilnahme",
    icon: CalendarCheck,
    suffix: "%",
  },
  { key: "penalties", label: "Strafen", icon: ShieldAlert },
] as const;

export default async function ProfilePage() {
  const user = await requireAuthenticatedUser();
  const data = await getProfileData(user.id);

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-600/20 via-[#151B24] to-[#151B24] p-6 sm:p-8">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            {data.user.avatarUrl ? (
              <Image
                src={data.user.avatarUrl}
                alt=""
                width={112}
                height={112}
                className="size-28 rounded-3xl border border-blue-400/30 object-cover"
              />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-3xl bg-blue-600">
                <UserRound size={44} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                Fahrerprofil
              </p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                {data.driver?.flag}{" "}
                {data.driver?.name ?? data.user.displayName}
              </h1>
              {data.driver ? (
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                  <span>#{data.driver.number}</span>
                  <span>·</span>
                  <span>{data.driver.countryCode}</span>
                  <span>·</span>
                  <span>
                    {data.driver.team?.name ?? "Ohne Team"}
                  </span>
                  <span>·</span>
                  <span>{data.driver.league.code}</span>
                </div>
              ) : (
                <p className="mt-3 text-slate-300">
                  Noch kein Fahrer mit diesem Benutzer verbunden.
                </p>
              )}
              <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
                {data.user.roles
                  .map((role) => roleLabels[role])
                  .join(" · ")}
              </p>
            </div>
            <Link href="/settings" className="wizard-secondary-button">
              <Settings size={18} />
              Einstellungen
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-3">
            <BellRing className="text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">
                Karrierestatistik
              </h2>
              <p className="text-sm text-slate-400">
                Aus Resultaten, Anmeldungen und FIA-Entscheidungen
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statConfig.map((stat) => {
              const Icon = stat.icon;
              return (
                <article key={stat.key} className="master-card">
                  <Icon className="text-blue-400" size={22} />
                  <p className="mt-4 text-3xl font-bold text-white">
                    {data.statistics[stat.key]}
                    {"suffix" in stat ? stat.suffix : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {stat.label}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
