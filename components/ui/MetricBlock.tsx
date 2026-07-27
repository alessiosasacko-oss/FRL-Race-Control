import type { LucideIcon } from "lucide-react";

type MetricTone = "blue" | "green" | "yellow" | "orange" | "purple" | "cyan";

const toneClasses: Record<MetricTone, string> = {
  blue: "border-blue-500/25 bg-blue-500/8 text-blue-300",
  green: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300",
  yellow: "border-amber-500/25 bg-amber-500/8 text-amber-300",
  orange: "border-orange-500/25 bg-orange-500/8 text-orange-300",
  purple: "border-violet-500/25 bg-violet-500/8 text-violet-300",
  cyan: "border-cyan-500/25 bg-cyan-500/8 text-cyan-300",
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
      className={`rounded-2xl border p-4 ${toneClasses[tone]} ${className}`}
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
