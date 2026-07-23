"use client";

type GeneralData = {
  league: string;
  season: string;
  race: string;
};

type Props = {
  data: GeneralData;
  setData: React.Dispatch<React.SetStateAction<GeneralData>>;
};

export default function GeneralStep({ data, setData }: Props) {
  return (
    <div className="space-y-8">

      <div>
        <h2 className="text-3xl font-bold text-white">
          Allgemeine Informationen
        </h2>

        <p className="mt-2 text-slate-400">
          Wähle Liga, Saison und Rennen aus.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Liga
          </label>

          <select
            value={data.league}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                league: e.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          >
            <option value="">Liga auswählen</option>
            <option>F1</option>
            <option>F2</option>
            <option>F3</option>
            <option>F4</option>
            <option>F5</option>
            <option>F6</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Saison
          </label>

          <select
            value={data.season}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                season: e.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          >
            <option value="">Saison auswählen</option>
            <option>Season 7</option>
            <option>Season 8</option>
          </select>
        </div>

      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Grand Prix
        </label>

        <input
          value={data.race}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              race: e.target.value,
            }))
          }
          placeholder="z.B. Belgium Grand Prix"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-blue-500"
        />
      </div>

    </div>
  );
}