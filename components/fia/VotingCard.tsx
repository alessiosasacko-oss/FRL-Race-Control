export default function VotingCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">
        🗳️ Steward-Bewertung
      </h2>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Empfohlene Strafe
          </label>

          <input
            type="text"
            placeholder="z. B. 5 Sekunden Zeitstrafe"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Begründung
          </label>

          <textarea
            rows={6}
            placeholder="Begründe deine Entscheidung..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
          />
        </div>

        <div className="flex justify-end">
          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
            Bewertung speichern
          </button>
        </div>
      </div>
    </div>
  );
}