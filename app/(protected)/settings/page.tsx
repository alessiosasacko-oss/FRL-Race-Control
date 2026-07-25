import { ShieldCheck } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import SettingsForms from "@/components/settings/SettingsForms";
import { roleLabels } from "@/domain";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getSettingsPageData } from "@/lib/settings/queries";

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser();
  const data = await getSettingsPageData(user.id);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Einstellungen
          </h1>
          <p className="mt-2 text-slate-400">
            Profil, Benachrichtigungen, Darstellung und Sicherheit.
          </p>
        </div>
        <SettingsForms data={data} />
        <section className="master-card">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-green-500/15 p-3 text-green-400">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Sicherheit
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Authentifizierung und aktuelle Berechtigungen
              </p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">
                Discord
              </dt>
              <dd className="mt-2 text-white">
                {data.user.discordId
                  ? `Verbunden · ${data.user.discordId}`
                  : "Nicht verbunden"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">
                E-Mail
              </dt>
              <dd className="mt-2 break-all text-white">
                {data.user.email ?? "Nicht hinterlegt"}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <dt className="text-xs uppercase tracking-widest text-slate-500">
                Rollen
              </dt>
              <dd className="mt-2 text-white">
                {data.user.roles.map((role) => roleLabels[role]).join(", ")}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </AppLayout>
  );
}
