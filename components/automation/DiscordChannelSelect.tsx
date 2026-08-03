"use client";

import { Hash, Search, ShieldAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  groupSelectableChannels,
  searchDiscordChannels,
  type DiscordChannelOption,
} from "@/lib/discord/channel-matrix";

type Props = {
  label: string;
  channels: readonly DiscordChannelOption[];
  value: string | null;
  onChange: (channelId: string | null) => void;
  suggestedChannelId?: string | null;
  disabled?: boolean;
};

export default function DiscordChannelSelect({
  label,
  channels,
  value,
  onChange,
  suggestedChannelId,
  disabled = false,
}: Props) {
  const id = useId();
  const [search, setSearch] = useState("");
  const visibleChannels = useMemo(
    () => searchDiscordChannels(channels, search),
    [channels, search],
  );
  const groups = useMemo(() => groupSelectableChannels(visibleChannels), [visibleChannels]);
  const selected = channels.find((channel) => channel.id === value) ?? null;
  const suggestion = channels.find((channel) => channel.id === suggestedChannelId && channel.selectable) ?? null;
  const storedMissing = Boolean(value && !selected);

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={`${id}-select`} className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input
          id={`${id}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kanal suchen"
          disabled={disabled}
          className="form-control min-h-11 w-full pl-10"
          aria-label={`${label} durchsuchen`}
        />
      </div>
      <select
        id={`${id}-select`}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        className="form-control min-h-11 w-full bg-[#0b111a] text-white [&>optgroup]:bg-[#0b111a] [&>option]:bg-[#0b111a]"
      >
        <option value="">Nicht zugeordnet</option>
        {storedMissing ? <option value={value!}>Gelöschter oder nicht sichtbarer Channel · {value}</option> : null}
        {groups.map((group) => (
          <optgroup key={group.category} label={group.category}>
            {group.channels.map((channel) => (
              <option key={channel.id} value={channel.id} disabled={!channel.selectable}>
                #{channel.name}{channel.selectable ? "" : ` · ${channel.unavailableReason ?? "ungeeignet"}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
          Keine passenden Textkanäle gefunden.
        </p>
      ) : null}
      {selected ? (
        <div className="flex flex-wrap gap-1.5 text-[0.68rem]">
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">Sichtbar</span>
          <span className={`rounded-full px-2 py-1 ${selected.canSend ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>Senden {selected.canSend ? "erlaubt" : "gesperrt"}</span>
          <span className={`rounded-full px-2 py-1 ${selected.canAttach ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>Anhänge {selected.canAttach ? "erlaubt" : "gesperrt"}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-slate-500"><Hash size={11} />{selected.id}</span>
        </div>
      ) : null}
      {storedMissing ? (
        <p className="flex items-start gap-2 text-xs text-red-300"><ShieldAlert className="mt-0.5 shrink-0" size={14} />Channel wurde gelöscht, ist unsichtbar oder wird nicht unterstützt.</p>
      ) : null}
      {!value && suggestion ? (
        <button
          type="button"
          onClick={() => onChange(suggestion.id)}
          className="min-h-11 w-full rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 text-left text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
        >
          Vorschlag übernehmen: #{suggestion.name}
        </button>
      ) : null}
    </div>
  );
}
