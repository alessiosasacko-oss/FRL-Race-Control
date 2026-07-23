import AppLayout from "@/components/layout/AppLayout";

export default function MasterDataLoading() {
  return (
    <AppLayout>
      <div className="space-y-6" aria-busy="true" aria-label="Daten werden geladen">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-800" />
        <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
