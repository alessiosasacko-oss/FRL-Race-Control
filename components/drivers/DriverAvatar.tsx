import Image from "next/image";
import { driverImageThumbnailUrl } from "@/lib/storage/driver-image";

type DriverAvatarSize = "xs" | "sm" | "md" | "lg" | "profile";

const classes: Record<DriverAvatarSize, string> = {
  xs: "size-8 text-[0.65rem]",
  sm: "size-10 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-lg",
  profile: "size-52 text-5xl sm:size-64 lg:size-72",
};

const sizes: Record<DriverAvatarSize, string> = {
  xs: "32px",
  sm: "40px",
  md: "48px",
  lg: "64px",
  profile: "(max-width: 639px) 208px, (max-width: 1023px) 256px, 288px",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "FR").toUpperCase();
}

export default function DriverAvatar({
  imageUrl,
  name,
  size = "md",
  priority = false,
  className = "",
}: {
  imageUrl: string | null | undefined;
  name: string;
  size?: DriverAvatarSize;
  priority?: boolean;
  className?: string;
}) {
  const source = size === "profile" ? imageUrl : driverImageThumbnailUrl(imageUrl);
  return (
    <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(145deg,#1e3a5f,#0f172a)] font-black tracking-wide text-blue-100 ${classes[size]} ${className}`}>
      {source ? (
        <Image src={source} alt={`Fahrerbild von ${name}`} fill sizes={sizes[size]} priority={priority} className="object-cover" />
      ) : (
        <span aria-label={`Kein Fahrerbild für ${name}`} role="img">{initials(name)}</span>
      )}
    </span>
  );
}
