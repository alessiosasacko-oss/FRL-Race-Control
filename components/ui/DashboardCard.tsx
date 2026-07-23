import { ReactNode } from "react";

type DashboardCardProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children?: ReactNode;
};

export default function DashboardCard({
  title,
  subtitle,
  icon,
  children,
}: DashboardCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10">

      <div className="mb-6 flex items-center gap-4">

        <div className="rounded-xl bg-blue-600 p-3">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">
            {title}
          </h2>

          {subtitle && (
            <p className="text-sm text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

      </div>

      {children}

    </div>
  );
}