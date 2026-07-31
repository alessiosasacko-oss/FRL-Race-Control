import Image from "next/image";
import { CircuitBoard, FlagTriangleRight, Gauge, Route } from "lucide-react";

type Visual = {
  layoutAsset: string | null;
  primaryColor: string;
  secondaryColor: string;
  useThemeLayoutColor: boolean;
  layoutColor: string | null;
  lineWidth: number;
  showStartFinish: boolean;
  showSectors: boolean;
  showDrsZones: boolean;
  showOvertakePoints: boolean;
  showCornerNumbers: boolean;
};

export default function TrackVisual({ visual, name }: { visual: Visual | null; name: string }) {
  const color = visual?.useThemeLayoutColor
    ? "var(--page-accent, var(--color-primary))"
    : visual?.layoutColor ?? visual?.primaryColor ?? "var(--color-primary)";
  return (
    <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--page-accent)_30%,transparent)] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--page-accent)_14%,transparent),transparent_65%)] p-7">
      {visual?.layoutAsset ? (
        <div className="relative aspect-square w-full max-w-md">
          <Image src={visual.layoutAsset} alt={`Streckenlayout ${name}`} fill sizes="(max-width: 768px) 90vw, 420px" className="object-contain drop-shadow-[0_0_24px_color-mix(in_srgb,var(--page-accent)_42%,transparent)]" unoptimized />
        </div>
      ) : (
        <div className="text-center">
          <Route className="mx-auto size-24" strokeWidth={1.2} style={{ color }} />
          <p className="mt-4 font-black">Track Layout</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Für {name} ist noch kein Layout hinterlegt.</p>
        </div>
      )}
      {visual ? (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
          {visual.showStartFinish ? <Tag icon={FlagTriangleRight} label="Start/Ziel" /> : null}
          {visual.showSectors ? <Tag icon={CircuitBoard} label="Sektoren" /> : null}
          {visual.showDrsZones ? <Tag icon={Gauge} label="DRS" /> : null}
          {visual.showOvertakePoints ? <Tag icon={Route} label="Overtake" /> : null}
          {visual.showCornerNumbers ? <Tag icon={CircuitBoard} label="Kurven" /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Tag({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  return <span className="rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_88%,transparent)] px-2 py-1 text-[var(--color-text-muted)]"><Icon className="mr-1 inline" size={11} />{label}</span>;
}
