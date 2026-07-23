import { Trophy, TrendingUp, Medal } from "lucide-react";
import Link from "next/link";

export default function ChampionshipCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">

      <div className="mb-5 flex items-center gap-3">

        <div className="rounded-xl bg-yellow-500 p-3">
          <Trophy size={22} className="text-white" />
        </div>

        <div>
          <h2 className="text-lg font-semibold">
            Meisterschaft
          </h2>

          <p className="text-sm text-slate-400">
            Aktueller Stand
          </p>
        </div>

      </div>

      <div className="space-y-4">

        <div className="flex items-center justify-between rounded-xl bg-[#0F141B] p-4">

          <div className="flex items-center gap-3">

            <div className="rounded-full bg-blue-600 p-2">
              <Medal size={18} />
            </div>

            <div>
              <p className="font-semibold">
                Platz 4
              </p>

              <p className="text-sm text-slate-400">
                132 Punkte
              </p>
            </div>

          </div>

          <TrendingUp className="text-green-500" />
        </div>

        <Link
          href="/championship"
          className="block rounded-xl bg-blue-600 py-3 text-center font-medium transition hover:bg-blue-700"
        >
          Tabelle ansehen
        </Link>

      </div>

    </div>
  );
}