"use client";

import { useActionState } from "react";
import {
  Bell,
  Languages,
  Mail,
  Moon,
  Save,
  UserRound,
} from "lucide-react";
import {
  NotificationType,
  notificationTypeLabels,
} from "@/domain";
import {
  updateNotificationSettingsAction,
  updateProfileSettingsAction,
} from "@/lib/settings/actions";
import {
  initialSettingsActionState,
  type SettingsPageData,
} from "@/lib/settings/types";
import FormMessage from "@/components/ui/FormMessage";
import CountrySelect from "@/components/ui/CountrySelect";

function CardTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
        <Icon size={21} />
      </span>
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function CategoryGrid({
  name,
  selected,
}: {
  name: string;
  selected: NotificationType[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {Object.values(NotificationType).map((type) => (
        <label
          key={type}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-3 text-sm text-slate-300 transition hover:border-blue-500/60"
        >
          <input
            type="checkbox"
            name={name}
            value={type}
            defaultChecked={selected.includes(type)}
            className="size-4 accent-blue-600"
          />
          {notificationTypeLabels[type]}
        </label>
      ))}
    </div>
  );
}

export default function SettingsForms({
  data,
}: {
  data: SettingsPageData;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileSettingsAction,
    initialSettingsActionState,
  );
  const [notificationState, notificationAction, notificationPending] =
    useActionState(
      updateNotificationSettingsAction,
      initialSettingsActionState,
    );

  return (
    <div className="space-y-6">
      <form action={profileAction} className="master-card">
        <CardTitle
          icon={UserRound}
          title="Profil"
          description="Öffentlicher Fahrername und Renndaten"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <label className="master-label md:col-span-3">
            Anzeigename
            <input
              name="displayName"
              defaultValue={data.user.displayName}
              required
              maxLength={160}
              className="form-control mt-2"
            />
          </label>
          {data.driver ? (
            <>
              <label className="master-label">Land<CountrySelect defaultValue={data.driver.countryCode} /></label>
              <label className="master-label">
                Fahrernummer
                <input
                  name="driverNumber"
                  type="number"
                  min={1}
                  max={999}
                  defaultValue={data.driver.number}
                  required
                  className="form-control mt-2"
                />
              </label>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Zuordnung
                </p>
                <p className="mt-2 text-white">
                  {data.driver.team ?? "Ohne Team"} · {data.driver.league}
                </p>
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="countryCode" value="" />
              <input type="hidden" name="driverNumber" value="" />
              <p className="md:col-span-3 text-sm text-slate-400">
                Deinem Benutzerkonto ist noch kein Fahrer zugeordnet.
              </p>
            </>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FormMessage state={profileState} />
          <button
            disabled={profilePending}
            className="wizard-primary-button"
          >
            <Save size={18} />
            {profilePending ? "Speichert…" : "Profil speichern"}
          </button>
        </div>
      </form>

      <form action={notificationAction} className="space-y-6">
        <section className="master-card">
          <CardTitle
            icon={Bell}
            title="In-App-Benachrichtigungen"
            description="Lege fest, welche Ereignisse im Notification Center erscheinen."
          />
          <label className="mb-5 flex items-center gap-3 text-sm font-medium text-white">
            <input
              type="checkbox"
              name="inAppEnabled"
              defaultChecked={data.settings.inAppEnabled}
              className="size-5 accent-blue-600"
            />
            In-App-Benachrichtigungen aktivieren
          </label>
          <CategoryGrid
            name="inAppCategory"
            selected={data.settings.inAppCategories}
          />
        </section>

        <section className="master-card">
          <CardTitle
            icon={Mail}
            title="E-Mail"
            description="E-Mails werden über die zuverlässige Zustellwarteschlange versendet."
          />
          <label className="mb-5 flex items-center gap-3 text-sm font-medium text-white">
            <input
              type="checkbox"
              name="emailEnabled"
              defaultChecked={data.settings.emailEnabled}
              disabled={!data.user.email}
              className="size-5 accent-blue-600"
            />
            E-Mail-Benachrichtigungen aktivieren
          </label>
          {!data.user.email ? (
            <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Für dieses Konto ist keine E-Mail-Adresse hinterlegt.
            </p>
          ) : null}
          <CategoryGrid
            name="emailCategory"
            selected={data.settings.emailCategories}
          />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="flex items-center gap-3 text-sm font-medium text-white md:col-span-3">
              <input
                type="checkbox"
                name="quietHoursEnabled"
                defaultChecked={data.settings.quietHoursEnabled}
                className="size-5 accent-blue-600"
              />
              Ruhezeiten berücksichtigen
            </label>
            <label className="master-label">
              Beginn
              <input
                type="time"
                name="quietHoursStart"
                defaultValue={data.settings.quietHoursStart}
                className="form-control mt-2"
              />
            </label>
            <label className="master-label">
              Ende
              <input
                type="time"
                name="quietHoursEnd"
                defaultValue={data.settings.quietHoursEnd}
                className="form-control mt-2"
              />
            </label>
            <label className="master-label">
              Zeitzone
              <input
                name="timezone"
                defaultValue={data.settings.timezone}
                className="form-control mt-2"
              />
            </label>
          </div>
        </section>

        <section className="master-card grid gap-5 md:grid-cols-2">
          <div>
            <CardTitle
              icon={Moon}
              title="Darstellung"
              description="Wähle deinen erlaubten persönlichen Farbmodus."
            />
            <label className="master-label">
              Theme
              <select
                name="theme"
                defaultValue={data.settings.theme}
                className="form-control mt-2"
              >
                <option value="dark">FRL Dark Blue</option>
                <option value="light">Light Mode</option>
                <option value="system">Systemeinstellung</option>
              </select>
            </label>
          </div>
          <div>
            <CardTitle
              icon={Languages}
              title="Sprache"
              description="Weitere Sprachen sind vorbereitet, aber noch nicht übersetzt."
            />
            <label className="master-label">
              Sprache
              <select
                name="language"
                defaultValue={data.settings.language}
                className="form-control mt-2"
              >
                <option value="de">Deutsch</option>
              </select>
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FormMessage state={notificationState} />
          <button
            disabled={notificationPending}
            className="wizard-primary-button"
          >
            <Save size={18} />
            {notificationPending
              ? "Speichert…"
              : "Einstellungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
