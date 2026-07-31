import type { CSSProperties } from "react";
import { backgroundPresentation, type BackgroundSettings } from "@/lib/design/theme";

type BackgroundStyle = CSSProperties & Record<`--${string}`, string>;

export default function AppBackground({
  settings,
  mode,
  preview = false,
}: {
  settings: BackgroundSettings;
  mode: "DARK" | "LIGHT";
  preview?: boolean;
}) {
  const presentation = backgroundPresentation(settings, mode);
  const layerStyle: BackgroundStyle = {
    position: preview || settings.imageAttachment === "SCROLL" ? "absolute" : "fixed",
    inset: settings.type === "IMAGE" && settings.imageBlur > 0 ? "-2rem" : 0,
    backgroundColor: presentation.fallbackColor,
    backgroundImage: presentation.image,
    backgroundSize: presentation.size,
    backgroundPosition: presentation.position,
    backgroundRepeat: presentation.repeat,
    backgroundAttachment: preview ? "scroll" : settings.imageAttachment.toLowerCase(),
    opacity: presentation.opacity,
    filter: presentation.filter,
    transform: presentation.rotation ? `scale(1.2) rotate(${presentation.rotation}deg)` : undefined,
    mixBlendMode: settings.type === "PATTERN" ? presentation.blendMode as CSSProperties["mixBlendMode"] : undefined,
    "--app-pattern-color": settings.patternColor,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true" data-testid="global-app-background">
      <span className="block" style={layerStyle} />
      <span className="absolute inset-0 block" style={{ backgroundColor: presentation.overlayColor, opacity: presentation.overlayOpacity }} />
      {settings.contentDim > 0 ? <span className="absolute inset-0 block bg-black" style={{ opacity: settings.contentDim / 100 }} /> : null}
    </div>
  );
}
