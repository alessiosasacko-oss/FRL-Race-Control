"use client";

import { ChevronDown } from "lucide-react";

type CharacterSelectProps = {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function CharacterSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: CharacterSelectProps) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </span>
      <span className="relative block min-w-0">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="character-select min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 pr-11 text-sm font-medium text-slate-100 shadow-inner shadow-black/20 outline-none transition hover:border-blue-500/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300"
          size={18}
        />
      </span>
    </label>
  );
}
