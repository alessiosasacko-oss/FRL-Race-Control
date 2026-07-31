import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
};

export default function StatCard({
  title,
  value,
  icon,
}: StatCardProps) {
  return (
    <div className="surface-panel p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h2 className="mt-1 text-3xl font-bold">{value}</h2>
        </div>

        <div className="rounded-xl bg-[var(--page-accent,var(--color-primary))] p-3 text-white shadow-lg">{icon}</div>
      </div>
    </div>
  );
}
