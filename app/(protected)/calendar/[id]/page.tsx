import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  Flag,
  Gauge,
  MapPin,
  Route,
  Ruler,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import Countdown from "@/components/dashboard/Countdown";
import TrackVisual from "@/components/tracks/TrackVisual";
import EmptyState from "@/components/ui/EmptyState";
import MetricBlock from "@/components/ui/MetricBlock";
import PageHeader from "@/components/ui/PageHeader";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getRaceWeekendPageData } from "@/lib/tracks/queries";

export default async function RaceWeekendPage({
  params,
}: PageProps<"/calendar/[id]">) {
  const user = await requirePermission(Permission.ViewMasterData);
  const { id } = await params;
  const raceId = Number(id);
  if (!Number.isInteger(raceId) || raceId <= 0) notFound();

  const race = await getRaceWeekendPageData(raceId, user.id);
  if (!race) notFound();

  const heroImage = race.track?.visual?.heroAsset;
  const heroStyle = heroImage
    ? {
        backgroundImage: `linear-gradient(90deg,rgba(3,7,18,.94),rgba(3,7,18,.48)),url(${JSON.stringify(heroImage)})`,
        backgroundSize: "cover",
        backgroundPosition: race.track?.visual?.imagePosition ?? "center",
      }
    : undefined;
  const ownSchedule = race.schedules.find(
    (schedule) => schedule.league.id === race.viewerLeagueId,
  );

  return (
    <AppLayout>
      <div className="page-stack page-accent-race">
        <PageHeader
          title={race.name}
          eyebrow={`${race.season.name} · Runde ${race.round}`}
          subtitle="Offizielle Race-Weekend-Zentrale"
          backHref="/calendar"
          backLabel="Zum Rennkalender"
          icon={Flag}
        />

        <section
          className="race-hero relative isolate overflow-hidden rounded-[1.75rem] border p-5 sm:p-8 lg:p-10"
          style={heroStyle}
        >
          <div className="grid gap-6 lg:min-h-72 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-8">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[color-mix(in_srgb,var(--page-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--page-accent)_14%,transparent)] px-3 py-1 text-xs font-black uppercase tracking-wider">
                  Race weekend
                </span>
                {race.sprint ? (
                  <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200">
                    Sprint
                  </span>
                ) : null}
                {race.doublePoints ? (
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
                    <Sparkles className="mr-1 inline" size={12} />
                    Doppelte Punkte
                  </span>
                ) : null}
              </div>
              <h1 className="mt-5 break-words text-3xl font-black tracking-[-0.045em] sm:text-4xl lg:mt-6 lg:text-6xl">
                {race.name}
              </h1>
              <p className="mt-4 flex items-start gap-2 text-base text-[var(--color-text-muted)] lg:text-lg">
                <MapPin size={20} className="mt-0.5 shrink-0 text-[var(--page-accent)]" />
                <span>
                  {race.circuit ?? "Mystery Track"}
                  {race.countryCode ? ` · ${race.countryCode}` : ""}
                </span>
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:mt-7 lg:flex lg:flex-wrap">
                <Link href="/attendance" className="wizard-primary-button">
                  Rennanmeldung
                </Link>
                <Link href={`/results/${race.id}`} className="wizard-secondary-button">
                  Ergebnisse
                </Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-black/35 p-5 backdrop-blur-lg">
              <p className="eyebrow">Start in</p>
              <div className="mt-2 font-mono text-3xl font-black">
                <Countdown target={race.scheduledAt} />
              </div>
              <p className="mt-5 flex items-start gap-2 border-t border-white/10 pt-5 text-sm">
                <CalendarDays size={17} className="mt-0.5 shrink-0 text-[var(--page-accent)]" />
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "full",
                  timeZone: race.timezone,
                }).format(new Date(race.scheduledAt))}
              </p>
              <p className="mt-3 flex items-start gap-2 text-sm">
                <Clock3 size={17} className="mt-0.5 shrink-0 text-[var(--color-secondary)]" />
                <span>
                  {new Intl.DateTimeFormat("de-DE", {
                    timeStyle: "short",
                    timeZone: race.timezone,
                  }).format(new Date(race.scheduledAt))} · {race.timezone}
                </span>
              </p>
            </aside>
          </div>
        </section>

        <section className="surface-panel p-5 lg:hidden" aria-labelledby="own-race-time">
          <p className="eyebrow">Dein Renntermin</p>
          <h2 id="own-race-time" className="mt-2 text-xl font-black text-white">
            {ownSchedule ? ownSchedule.league.code : "Noch keine Liga zugeordnet"}
          </h2>
          {ownSchedule ? (
            <p className="mt-4 flex items-start gap-3 text-lg font-semibold text-cyan-200">
              <Clock3 size={20} className="mt-0.5 shrink-0" />
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: ownSchedule.timezone,
              }).format(new Date(ownSchedule.scheduledAt))}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
              Sobald deinem Fahrerprofil eine Liga zugeordnet ist, erscheint hier dein persönlicher Starttermin.
            </p>
          )}
        </section>

        {race.track ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
            <TrackVisual visual={race.track.visual} name={race.track.name} />
            <MobileTrackFacts race={race} />
            <DesktopTrackFacts race={race} />
          </div>
        ) : (
          <EmptyState
            icon={<Route size={24} />}
            title={race.mystery ? "Mystery Track" : "Noch keine Streckendaten"}
            description={
              race.mystery
                ? "Streckendetails werden gemäß der Ein-Stunden-Regel veröffentlicht."
                : "Die Race-Weekend-Struktur steht bereit, sobald die Strecke zentral zugeordnet wurde."
            }
          />
        )}

        <section className="hidden lg:block">
          <h2 className="mb-4 text-2xl font-black">Liga-Zeitplan</h2>
          <ScheduleGrid schedules={race.schedules} />
        </section>
        <details className="surface-panel lg:hidden">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between px-5 font-bold text-white">
            <span>Alle Liga-Termine</span>
            <Clock3 size={18} className="text-cyan-300" />
          </summary>
          <div className="border-t border-[var(--color-border)] p-4">
            <ScheduleGrid schedules={race.schedules} />
          </div>
        </details>
      </div>
    </AppLayout>
  );
}

type RaceWeekendData = NonNullable<Awaited<ReturnType<typeof getRaceWeekendPageData>>>;

function MobileTrackFacts({ race }: { race: RaceWeekendData }) {
  if (!race.track) return null;
  return (
    <section className="surface-panel p-5 lg:hidden">
      <p className="eyebrow">Circuit intelligence</p>
      <h2 className="mt-2 text-2xl font-black">Key Facts</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact icon={Ruler} label="Streckenlänge" value={race.track.lengthKm ? `${race.track.lengthKm} km` : "Noch offen"} />
        <Fact icon={Route} label="Runden" value={race.track.lapCount ?? "Noch offen"} />
        <Fact icon={Gauge} label="Gesamtdistanz" value={race.track.totalDistanceKm ? `${race.track.totalDistanceKm} km` : "Noch offen"} />
        <Fact icon={Sparkles} label="DRS-Zonen" value={race.track.drsZones ?? "Noch offen"} />
      </div>
      <details className="mt-4 rounded-xl border border-[var(--color-border)]">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-bold text-cyan-200">
          Weitere Streckendaten
        </summary>
        <div className="grid gap-3 border-t border-[var(--color-border)] p-3 sm:grid-cols-2">
          <Fact icon={Trophy} label="Overtake Points" value={race.track.overtakePoints ?? "Noch offen"} />
          <Fact icon={Timer} label="Pitlane-Verlust" value={race.track.pitLaneLossSeconds ? `${race.track.pitLaneLossSeconds} s` : "Noch offen"} />
          <Fact icon={Route} label="Sektoren" value={race.track.sectorCount} />
          <Fact icon={Ruler} label="Längste Gerade" value={race.track.longestStraightM ? `${race.track.longestStraightM} m` : "Noch offen"} />
          <Fact icon={Flag} label="Pole-Seite" value={race.track.poleSide ?? "Noch offen"} />
        </div>
      </details>
      {race.track.notes ? <TrackNotes notes={race.track.notes} /> : null}
    </section>
  );
}

function DesktopTrackFacts({ race }: { race: RaceWeekendData }) {
  if (!race.track) return null;
  return (
    <section className="surface-panel hidden p-5 sm:p-6 lg:block">
      <p className="eyebrow">Circuit intelligence</p>
      <h2 className="mt-2 text-2xl font-black">Key Facts</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Fact icon={Ruler} label="Streckenlänge" value={race.track.lengthKm ? `${race.track.lengthKm} km` : "Noch offen"} />
        <Fact icon={Route} label="Runden" value={race.track.lapCount ?? "Noch offen"} />
        <Fact icon={Gauge} label="Gesamtdistanz" value={race.track.totalDistanceKm ? `${race.track.totalDistanceKm} km` : "Noch offen"} />
        <Fact icon={Sparkles} label="DRS-Zonen" value={race.track.drsZones ?? "Noch offen"} />
        <Fact icon={Trophy} label="Overtake Points" value={race.track.overtakePoints ?? "Noch offen"} />
        <Fact icon={Timer} label="Pitlane-Verlust" value={race.track.pitLaneLossSeconds ? `${race.track.pitLaneLossSeconds} s` : "Noch offen"} />
        <Fact icon={Route} label="Sektoren" value={race.track.sectorCount} />
        <Fact icon={Ruler} label="Längste Gerade" value={race.track.longestStraightM ? `${race.track.longestStraightM} m` : "Noch offen"} />
      </div>
      {race.track.notes ? <TrackNotes notes={race.track.notes} /> : null}
    </section>
  );
}

function ScheduleGrid({ schedules }: { schedules: RaceWeekendData["schedules"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {schedules.map((schedule) => (
        <MetricBlock
          key={schedule.id}
          label={`${schedule.league.code} · ${schedule.league.name}`}
          value={new Intl.DateTimeFormat("de-DE", {
            timeStyle: "short",
            timeZone: schedule.timezone,
          }).format(new Date(schedule.scheduledAt))}
          detail={schedule.timezone}
          icon={Clock3}
          tone="cyan"
        />
      ))}
      {schedules.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Noch keine Liga-Termine geplant.</p>
      ) : null}
    </div>
  );
}

function TrackNotes({ notes }: { notes: string }) {
  return (
    <p className="mt-5 border-t border-[var(--color-border)] pt-5 text-sm leading-6 text-[var(--color-text-muted)]">
      {notes}
    </p>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
      <Icon size={17} className="text-[var(--page-accent)]" />
      <p className="mt-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <strong className="mt-1 block text-lg">{value}</strong>
    </div>
  );
}
