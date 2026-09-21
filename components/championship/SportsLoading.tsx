import AppLayout from "@/components/layout/AppLayout";

export default function SportsLoading() {
  return (
    <AppLayout>
      <div
        className="space-y-7"
        aria-busy="true"
        aria-label="Sportdaten werden geladen"
      >
        <div className="border-b border-slate-800 pb-6"><div className="h-3 w-32 animate-pulse bg-blue-500/20" /><div className="mt-4 h-10 w-72 max-w-full animate-pulse bg-slate-800" /><div className="mt-3 h-4 w-full max-w-2xl animate-pulse bg-slate-900" /></div>
        <div className="h-44 animate-pulse border border-slate-800 bg-slate-900/70" />
        <div className="divide-y divide-slate-800 border border-slate-800">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse bg-slate-900/60"
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
