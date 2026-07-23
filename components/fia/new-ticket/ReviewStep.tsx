import {
  evidenceTypeLabels,
  raceSessionLabels,
  ticketPriorityLabels,
} from "@/domain";
import type { TicketWizardOptions } from "@/lib/fia/types";
import type { TicketWizardDraft } from "./wizard-types";

type ReviewStepProps = {
  data: TicketWizardDraft;
  options: TicketWizardOptions;
};

export default function ReviewStep({ data, options }: ReviewStepProps) {
  const league = options.leagues.find(
    (item) => item.id === Number(data.leagueId),
  );
  const season = options.seasons.find(
    (item) => item.id === Number(data.seasonId),
  );
  const race = options.races.find(
    (item) => item.id === Number(data.raceId),
  );
  const drivers = options.drivers.filter((driver) =>
    data.driverIds.includes(driver.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Übersicht</h2>
        <p className="mt-2 text-slate-400">
          Prüfe alle Angaben vor dem verbindlichen Erstellen.
        </p>
      </div>

      <dl className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2">
        <ReviewItem label="Liga" value={league?.name ?? "–"} />
        <ReviewItem label="Saison" value={season?.name ?? "–"} />
        <ReviewItem label="Rennen" value={race?.name ?? "–"} />
        <ReviewItem
          label="Session"
          value={raceSessionLabels[data.session]}
        />
        <ReviewItem label="Titel" value={data.title} />
        <ReviewItem
          label="Ort"
          value={
            [
              data.lap ? `Runde ${data.lap}` : "",
              data.corner,
            ]
              .filter(Boolean)
              .join(" · ") || "Nicht angegeben"
          }
        />
        <ReviewItem
          label="Priorität"
          value={ticketPriorityLabels[data.priority]}
        />
        <ReviewItem
          label="Fahrer"
          value={drivers
            .map((driver) => `#${driver.number} ${driver.name}`)
            .join(", ")}
        />
      </dl>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-white">Beschreibung</h3>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-300">
          {data.description}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="font-semibold text-white">
          Beweise ({data.evidence.length})
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {data.evidence.map((evidence) => (
            <li key={evidence.key}>
              {evidenceTypeLabels[evidence.type]} · {evidence.label}
            </li>
          ))}
          {data.evidence.length === 0 ? <li>Keine Beweise</li> : null}
        </ul>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}
