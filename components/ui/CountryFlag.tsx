import { Globe2 } from "lucide-react";
import {
  countryCodeToFlagEmoji,
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

const sizeClasses = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
} as const;

export default function CountryFlag({
  countryCode,
  countryName,
  fallbackFlag,
  size = "md",
  showLabel = false,
  className = "",
}: CountryFlagProps) {
  const normalized = normalizeCountryCode(countryCode);
  const normalizedFallback = normalizeCountryCode(fallbackFlag);
  const flag =
    countryCodeToFlagEmoji(normalized) ??
    countryCodeToFlagEmoji(normalizedFallback) ??
    (fallbackFlag && fallbackFlag.trim().length <= 8 ? fallbackFlag.trim() : null);
  const label = countryName ?? resolveCountryName(normalized);

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {flag ? (
        <span
          role="img"
          aria-label={`Flagge: ${label}`}
          className={`${sizeClasses[size]} shrink-0 leading-none`}
        >
          {flag}
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center text-slate-500">
          <Globe2 aria-hidden="true" size={size === "lg" ? 28 : size === "md" ? 20 : 16} />
          <span className="sr-only">Land nicht angegeben</span>
        </span>
      )}
      {showLabel ? (
        <span className="min-w-0 break-words">{label}</span>
      ) : null}
    </span>
  );
}
