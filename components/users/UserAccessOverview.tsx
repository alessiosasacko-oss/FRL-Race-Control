import { CheckCircle2, Eye, LockKeyhole, ShieldAlert } from "lucide-react";
import type { EffectiveAccessEntry } from "@/lib/users/permissions";

type UserAccessOverviewProps = {
  userName: string;
  navigation: EffectiveAccessEntry[];
  actions: EffectiveAccessEntry[];
  restrictions: string[];
  preview?: boolean;
};

const statusConfig = {
  ALLOWED: { label: "Erlaubt", className: "text-emerald-300", icon: CheckCircle2 },
  RESTRICTED: { label: "Eingeschränkt", className: "text-amber-300", icon: ShieldAlert },
  DENIED: { label: "Nicht erlaubt", className: "text-red-300", icon: LockKeyhole },
} as const;

export default function UserAccessOverview({
  userName,
  navigation,
  actions,
  restrictions,
  preview = false,
}: UserAccessOverviewProps) {
  return (
    <section className="surface-panel p-5 sm:p-6">
      {preview ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
          <Eye size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Berechtigungsvorschau für {userName} – keine echte Benutzerübernahme</p>
            <p className="mt-1 text-sm text-cyan-100/75">
              Schreibgeschützt. Es werden keine Discord-Tokens oder Aktionen dieses Benutzers verwendet.
            </p>
          </div>
        </div>
      ) : null}
      <p className="eyebrow">Effektive Berechtigungen</p>
      <h2 className="mt-2 text-xl font-black text-white">
        Was darf dieser Benutzer sehen und machen?
      </h2>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AccessGroup title="Navigation" entries={navigation} />
        <AccessGroup title="Aktionen" entries={actions} />
      </div>
      <details className="mt-5 rounded-xl border border-[var(--color-border)]">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-white">
          Einschränkungen und Kontext
        </summary>
        <ul className="space-y-2 border-t border-[var(--color-border)] p-4 text-sm text-slate-400">
          {restrictions.map((restriction) => <li key={restriction}>{restriction}</li>)}
        </ul>
      </details>
    </section>
  );
}

function AccessGroup({ title, entries }: { title: string; entries: EffectiveAccessEntry[] }) {
  return (
    <div>
      <h3 className="font-bold text-white">{title}</h3>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => {
          const config = statusConfig[entry.status];
          const Icon = config.icon;
          return (
            <article key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <strong className="text-sm text-white">{entry.label}</strong>
                <span className={`flex shrink-0 items-center gap-1 text-xs font-bold ${config.className}`}>
                  <Icon size={14} /> {config.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{entry.reason}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
