import { getImageProps } from "next/image";
import type { PublicRaceHero } from "@/lib/races/visibility";

export default function RaceHeroMedia({
  hero,
  priority = false,
}: {
  hero: PublicRaceHero;
  priority?: boolean;
}) {
  const common = {
    alt: hero.alt,
    sizes: "100vw",
    loading: priority ? "eager" as const : "lazy" as const,
  };
  const { props: { srcSet: desktopSrcSet } } = getImageProps({
    ...common,
    src: hero.desktopUrl,
    width: 1920,
    height: 1080,
    quality: 75,
  });
  const { props: { srcSet: mobileSrcSet, ...mobileProps } } = getImageProps({
    ...common,
    src: hero.mobileUrl,
    width: 1080,
    height: 1350,
    quality: 75,
  });

  return (
    <picture className="absolute inset-0 z-0 block overflow-hidden">
      <source media="(min-width: 1024px)" srcSet={desktopSrcSet} />
      <source media="(max-width: 1023px)" srcSet={mobileSrcSet} />
      <img
        {...mobileProps}
        alt={hero.alt}
        fetchPriority={priority ? "high" : "auto"}
        className="h-full w-full object-cover"
      />
    </picture>
  );
}
