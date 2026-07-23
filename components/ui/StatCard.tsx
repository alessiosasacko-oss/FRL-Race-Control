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
    <div className="rounded-xl border border-slate-800 bg-[#151B24] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h2 className="mt-1 text-3xl font-bold">{value}</h2>
        </div>

        <div className="rounded-xl bg-blue-600 p-3">{icon}</div>
      </div>
    </div>
  );
}
