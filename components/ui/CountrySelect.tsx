"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { countryName, countryOptions, normalizeCountryCode } from "@/lib/countries";
import CountryFlag from "./CountryFlag";

type CountrySelectProps = {
  name?: string;
  defaultValue?: string | null;
  className?: string;
  required?: boolean;
};

export default function CountrySelect({
  name = "countryCode",
  defaultValue,
  className = "form-control mt-2",
  required = true,
}: CountrySelectProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const initialCode = normalizeCountryCode(defaultValue) ?? (required ? countryOptions[0]?.code ?? "" : "");
  const [selectedCode, setSelectedCode] = useState(initialCode);
  const selectedName = countryName(selectedCode);

  function select(code: string) {
    setSelectedCode(code);
    details.current?.removeAttribute("open");
  }

  return (
    <details ref={details} className="relative min-w-0">
      <input type="hidden" name={name} value={selectedCode} />
      <summary className={`${className} flex min-h-11 cursor-pointer list-none items-center gap-3 pr-3`}>
        <CountryFlag countryCode={selectedCode} size="sm" />
        <span className="min-w-0 flex-1 truncate text-left">
          {selectedCode ? `${selectedName} – ${selectedCode}` : "Land nicht angegeben"}
        </span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-slate-500" size={18} />
      </summary>
      <div role="listbox" aria-label="Land auswählen" className="absolute inset-x-0 top-full z-40 mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
        {!required ? (
          <button type="button" role="option" aria-selected={selectedCode === ""} onClick={() => select("")} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-300 hover:bg-slate-800">
            <CountryFlag countryCode={null} size="sm" />
            Land nicht angegeben
          </button>
        ) : null}
        {countryOptions.map((country) => (
          <button key={country.code} type="button" role="option" aria-selected={selectedCode === country.code} onClick={() => select(country.code)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-slate-800 ${selectedCode === country.code ? "bg-blue-500/10 text-blue-100" : "text-slate-300"}`}>
            <CountryFlag countryCode={country.code} size="sm" />
            <span className="min-w-0 truncate">{country.name} – {country.code}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
