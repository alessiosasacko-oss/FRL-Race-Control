export default function HistoryCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">
        📜 Verlauf
      </h2>

      <div className="space-y-4 text-slate-300">
        <p>🕒 14:22 – Ticket erstellt</p>
        <p>🕒 14:28 – Replay hinzugefügt</p>
        <p>🕒 14:35 – Erster Kommentar</p>
      </div>
    </div>
  );
}