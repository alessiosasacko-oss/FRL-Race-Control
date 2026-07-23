import { Flag, Clock, MapPin } from "lucide-react";

export default function NextRaceCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">

      <div className="flex items-center gap-3 mb-5">

        <div className="rounded-xl bg-blue-600 p-3">
          <Flag size={22} />
        </div>

        <div>
          <h2 className="text-lg font-semibold">
            Nächstes Rennen
          </h2>

          <p className="text-sm text-slate-400">
            Formula 1
          </p>
        </div>

      </div>

      <h3 className="text-2xl font-bold">
        Bahrain Grand Prix
      </h3>

      <div className="mt-5 space-y-3 text-slate-400">

        <div className="flex items-center gap-2">
          <Clock size={18} />
          Sonntag • 20:00 Uhr
        </div>

        <div className="flex items-center gap-2">
          <MapPin size={18} />
          Bahrain International Circuit
        </div>

      </div>

    </div>
  );
}