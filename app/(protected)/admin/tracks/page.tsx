import { Map } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import TrackForm from "@/components/tracks/TrackForm";
import PageHeader from "@/components/ui/PageHeader";
import CountryFlag from "@/components/ui/CountryFlag";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getTrackAdminData } from "@/lib/tracks/queries";

export default async function TracksAdminPage() {
  await requirePermission(Permission.ManageBranding);
  const tracks = await getTrackAdminData();
  return (
    <AppLayout>
      <div className="page-stack page-accent-race">
        <PageHeader title="Streckenverwaltung" eyebrow="Design & Branding" subtitle="Fachliche Streckendaten, Layouts und responsive Race-Weekend-Visuals zentral pflegen." icon={Map} />
        <details className="master-card" open={tracks.length === 0}>
          <summary className="cursor-pointer text-lg font-black">Neue Strecke anlegen</summary>
          <div className="mt-5 border-t border-[var(--color-border)] pt-5"><TrackForm /></div>
        </details>
        <section className="space-y-4">
          {tracks.map((track) => (
            <details key={track.id} className="master-card">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-4"><div><p className="eyebrow inline-flex items-center gap-2"><CountryFlag countryCode={track.countryCode} size="sm" />{track._count.races} Rennen</p><h2 className="mt-1 text-xl font-black">{track.name}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${track.active ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}>{track.active ? "Aktiv" : "Inaktiv"}</span></div>
              </summary>
              <div className="mt-5 border-t border-[var(--color-border)] pt-5"><TrackForm track={track} /></div>
            </details>
          ))}
        </section>
      </div>
    </AppLayout>
  );
}
