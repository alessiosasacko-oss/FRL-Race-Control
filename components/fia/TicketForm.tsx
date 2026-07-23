import { races } from "@/lib/data/races";

export default function TicketForm() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Rennen
          </label>

          <select className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white">
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Vorfall
          </label>

          <input
            type="text"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
            placeholder="z. B. Kollision in Turn 1"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Runde
          </label>

          <input
            type="number"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
            placeholder="24"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Kurve
          </label>

          <input
            type="text"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
            placeholder="Turn 1"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Beschreibung
        </label>

        <textarea
          rows={6}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
          placeholder="Beschreibe den Vorfall..."
        />
      </div>

      <div className="mt-8 flex justify-end">
        <button className="rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-700">
          Ticket erstellen
        </button>
      </div>
    </div>
  );
}
