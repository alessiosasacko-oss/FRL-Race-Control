export default function DiscussionCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">
        💬 Steward-Diskussion
      </h2>

      <textarea
        rows={6}
        placeholder="Kommentar schreiben..."
        className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white"
      />

      <div className="mt-4 flex justify-end">
        <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
          Kommentar senden
        </button>
      </div>
    </div>
  );
}