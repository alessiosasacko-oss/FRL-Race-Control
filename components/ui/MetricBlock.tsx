import type { LucideIcon } from "lucide-react";

type MetricTone = "blue" | "green" | "yellow" | "orange" | "purple" | "cyan";

const toneClasses: Record<MetricTone, string> = {
  blue: "metric-tone-blue",
  green: "metric-tone-green",
  yellow: "metric-tone-yellow",
  orange: "metric-tone-orange",
  purple: "metric-tone-purple",
  cyan: "metric-tone-cyan",
};

type MetricBlockProps = {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  className?: string;
};

export default function MetricBlock({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
  className = "",
}: MetricBlockProps) {
  return (
    <div
      className={`metric-block rounded-2xl border p-4 ${toneClasses[tone]} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        {Icon ? <Icon aria-hidden="true" size={17} /> : null}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
      {detail ? (
        <div className="mt-1.5 text-xs leading-5 text-slate-400">{detail}</div>
      ) : null}
    </div>
  );
}
