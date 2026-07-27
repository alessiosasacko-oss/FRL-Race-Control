type BadgeProps = {
  color?:
    | "blue"
    | "green"
    | "red"
    | "yellow"
    | "orange"
    | "purple"
    | "cyan"
    | "gray";
  children: React.ReactNode;
};

const colors = {
  blue: "border-blue-500/30 bg-blue-500/12 text-blue-300",
  green: "border-emerald-500/30 bg-emerald-500/12 text-emerald-300",
  red: "border-red-500/30 bg-red-500/12 text-red-300",
  yellow: "border-amber-500/30 bg-amber-500/12 text-amber-300",
  orange: "border-orange-500/30 bg-orange-500/12 text-orange-300",
  purple: "border-violet-500/30 bg-violet-500/12 text-violet-300",
  cyan: "border-cyan-500/30 bg-cyan-500/12 text-cyan-300",
  gray: "border-slate-700 bg-slate-800/70 text-slate-300",
};

export default function Badge({
  color = "gray",
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  );
}
