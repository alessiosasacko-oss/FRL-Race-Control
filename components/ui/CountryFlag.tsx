"use client";

import Image from "next/image";
import { useState } from "react";
import { Globe2 } from "lucide-react";
import {
  countryCodeFromLegacyFlag,
  countryFlagPath,
  countryName as resolveCountryName,
  normalizeCountryCode,
} from "@/lib/countries";

type CountryFlagProps = {
  countryCode: string | null | undefined;
  countryName?: string;
  fallbackFlag?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

const sizes = {
  sm: { width: 20, height: 14, className: "h-[14px] w-5", icon: 16 },
  md: { width: 28, height: 19, className: "h-[19px] w-7", icon: 20 },
  lg: { width: 40, height: 27, className: "h-[27px] w-10", icon: 28 },
} as const;

export default function CountryFlag({
  countryCode,
  countryName,
  fallbackFlag,
  size = "md",
  showLabel = false,
  className = "",
}: CountryFlagProps) {
  const code = normalizeCountryCode(countryCode) ?? countryCodeFromLegacyFlag(fallbackFlag);
  const path = countryFlagPath(code);
  const label = code ? (countryName ?? resolveCountryName(code)) : "Land nicht angegeben";

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {path ? (
        <FlagImage key={path} path={path} label={label} size={size} />
      ) : (
        <FlagFallback size={size} />
      )}
      {showLabel ? <span className="min-w-0 break-words">{label}</span> : null}
    </span>
  );
}

function FlagImage({
  path,
  label,
  size,
}: {
  path: string;
  label: string;
  size: keyof typeof sizes;
}) {
  const [failed, setFailed] = useState(false);
  const dimensions = sizes[size];
  if (failed) return <FlagFallback size={size} />;

  return (
    <Image
      src={path}
      alt={`Flagge: ${label}`}
      width={dimensions.width}
      height={dimensions.height}
      unoptimized
      onError={() => setFailed(true)}
      className={`${dimensions.className} shrink-0 rounded-[3px] border border-white/15 object-cover`}
    />
  );
}

function FlagFallback({ size }: { size: keyof typeof sizes }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center text-slate-500">
      <Globe2 aria-hidden="true" size={sizes[size].icon} />
      <span className="sr-only">Land nicht angegeben</span>
    </span>
  );
}
