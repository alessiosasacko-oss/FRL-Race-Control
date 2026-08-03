"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { teamLogoThumbnailUrl } from "@/lib/storage/team-logo-image";

const sizes = {
  xs: { pixels: 24, className: "size-6 rounded-md text-[0.55rem]" },
  sm: { pixels: 32, className: "size-8 rounded-lg text-[0.65rem]" },
  md: { pixels: 48, className: "size-12 rounded-xl text-xs" },
  lg: { pixels: 80, className: "size-16 rounded-2xl text-sm sm:size-20" },
  hero: { pixels: 112, className: "size-24 rounded-2xl text-xl sm:size-28" },
} as const;

export type TeamLogoProps = {
  logoUrl?: string | null;
  teamName: string;
  shortName?: string | null;
  primaryColor?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
  showFallback?: boolean;
};

function initials(teamName: string, shortName?: string | null): string {
  const short = shortName?.trim();
  if (short) return short.slice(0, 3).toUpperCase();
  return teamName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase() || "FRL";
}

function TeamLogoComponent({
  logoUrl,
  teamName,
  shortName,
  primaryColor = "#2563EB",
  size = "sm",
  className = "",
  priority = false,
  showFallback = true,
}: TeamLogoProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const variant = sizes[size];
  const compactUrl = size === "xs" || size === "sm" || size === "md" ? teamLogoThumbnailUrl(logoUrl) : logoUrl;
  const shared = `relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-slate-950/45 ${variant.className} ${className}`;

  if (!compactUrl || failedUrl === compactUrl) {
    if (!showFallback) return null;
    return (
      <span
        role="img"
        aria-label={`${teamName} Logo-Platzhalter`}
        title={teamName}
        className={`${shared} font-black tracking-tight text-white shadow-inner`}
        style={{ backgroundColor: primaryColor ?? "#2563EB" }}
      >
        {initials(teamName, shortName)}
      </span>
    );
  }

  return (
    <span className={shared}>
      <Image
        src={compactUrl}
        alt={`${teamName} Logo`}
        width={variant.pixels}
        height={variant.pixels}
        sizes={`${variant.pixels}px`}
        priority={priority}
        onError={() => setFailedUrl(compactUrl)}
        className="size-full object-contain p-0.5"
      />
    </span>
  );
}

const TeamLogo = memo(TeamLogoComponent);
export default TeamLogo;
