export default function EvidenceCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">
        🎥 Beweise
      </h2>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Replay-Link einfügen..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
        />

        <button className="rounded-xl bg-slate-800 px-5 py-3 text-white transition hover:bg-slate-700">
          📎 Datei hochladen
        </button>
      </div>
    </div>
  );
}