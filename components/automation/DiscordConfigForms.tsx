"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import { Hash, Save, Server, ShieldCheck } from "lucide-react";
import {
  DiscordChannelPurpose,
  Role,
  roleLabels,
} from "@/domain";
import {
  saveDiscordChannelAction,
  saveDiscordGuildAction,
  saveDiscordRoleAction,
} from "@/lib/automation/actions";
import {
  initialAutomationActionState,
  type AutomationDashboardData,
} from "@/lib/automation/types";
import FormMessage from "@/components/ui/FormMessage";

const purposeLabels: Record<DiscordChannelPurpose, string> = {
  [DiscordChannelPurpose.AttendanceOpened]: "Rennanmeldung geöffnet",
  [DiscordChannelPurpose.AttendanceClosingSoon]: "Rennanmeldung schließt bald",
  [DiscordChannelPurpose.AttendanceClosed]: "Rennanmeldung geschlossen",
  [DiscordChannelPurpose.RaceWeekend]: "Rennwochenende",
  [DiscordChannelPurpose.SprintResults]: "Sprint-Ergebnisse",
  [DiscordChannelPurpose.RaceResults]: "Renn-Ergebnisse",
  [DiscordChannelPurpose.DriverStandings]: "Fahrerwertung",
  [DiscordChannelPurpose.TeamStandings]: "Teamwertung",
  [DiscordChannelPurpose.FiaDecision]: "FIA-Entscheidungen",
  [DiscordChannelPurpose.PenaltyIssued]: "Strafen",
  [DiscordChannelPurpose.SeasonStarted]: "Saisonstart",
  [DiscordChannelPurpose.SeasonFinished]: "Saisonende",
  [DiscordChannelPurpose.AdminAnnouncement]: "Admin-Mitteilungen",
};

type Props = Pick<AutomationDashboardData, "guilds" | "leagues">;

export default function DiscordConfigForms({ guilds, leagues }: Props) {
  const [guildState, guildAction, guildPending] = useActionState(
    saveDiscordGuildAction,
    initialAutomationActionState,
  );
  const [channelState, channelAction, channelPending] = useActionState(
    saveDiscordChannelAction,
    initialAutomationActionState,
  );
  const [roleState, roleAction, rolePending] = useActionState(
    saveDiscordRoleAction,
    initialAutomationActionState,
  );
  const defaultGuild = guilds[0];

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <form action={guildAction} className="master-card">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
            <Server size={21} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Discord-Server
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Bot mit dem FRL-Guild verbinden.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <label className="master-label">
            Guild-ID
            <input
              name="guildId"
              required
              defaultValue={defaultGuild?.guildId}
              className="form-control mt-2"
            />
          </label>
          <label className="master-label">
            Anzeigename
            <input
              name="guildName"
              required
              defaultValue={defaultGuild?.guildName}
              className="form-control mt-2"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={defaultGuild?.enabled ?? true}
              className="size-5 accent-blue-600"
            />
            Integration aktiv
          </label>
        </div>
        <div className="mt-5 space-y-3">
          <FormMessage state={guildState} />
          <button
            disabled={guildPending}
            className="wizard-primary-button w-full"
          >
            <Save size={17} />
            Server speichern
          </button>
        </div>
      </form>

      <form action={channelAction} className="master-card">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
            <Hash size={21} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Kanalzuordnung
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Globaler oder ligaspezifischer Zielkanal.
            </p>
          </div>
        </div>
        {defaultGuild ? (
          <div className="mt-5 space-y-4">
            <input
              type="hidden"
              name="guildSettingsId"
              value={defaultGuild.id}
            />
            <label className="master-label">
              Ereignis
              <select name="purpose" className="form-control mt-2">
                {Object.values(DiscordChannelPurpose).map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purposeLabels[purpose]}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-label">
              Liga
              <select name="leagueId" className="form-control mt-2">
                <option value="">Global</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.code} · {league.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-label">
              Kanal-ID
              <input name="channelId" required className="form-control mt-2" />
            </label>
            <label className="master-label">
              Kanalname (optional)
              <input name="channelName" className="form-control mt-2" />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked
                className="size-5 accent-blue-600"
              />
              Zuordnung aktiv
            </label>
            <FormMessage state={channelState} />
            <button
              disabled={channelPending}
              className="wizard-primary-button w-full"
            >
              <Save size={17} />
              Kanal speichern
            </button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-amber-300">
            Zuerst einen Discord-Server speichern.
          </p>
        )}
      </form>

      <form action={roleAction} className="master-card">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-600/15 p-3 text-blue-400">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">
              Rollenzuordnung
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Kanonische FRL-Rolle zu Discord-Rolle.
            </p>
          </div>
        </div>
        {defaultGuild ? (
          <div className="mt-5 space-y-4">
            <input
              type="hidden"
              name="guildSettingsId"
              value={defaultGuild.id}
            />
            <label className="master-label">
              FRL-Rolle
              <select name="role" className="form-control mt-2">
                {Object.values(Role).map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-label">
              Discord-Rollen-ID
              <input
                name="discordRoleId"
                required
                className="form-control mt-2"
              />
            </label>
            <label className="master-label">
              Rollenname (optional)
              <input name="discordRoleName" className="form-control mt-2" />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked
                className="size-5 accent-blue-600"
              />
              Synchronisierung aktiv
            </label>
            <FormMessage state={roleState} />
            <button
              disabled={rolePending}
              className="wizard-primary-button w-full"
            >
              <Save size={17} />
              Rolle speichern
            </button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-amber-300">
            Zuerst einen Discord-Server speichern.
          </p>
        )}
      </form>
    </div>
  );
}
