import type { LucideIcon } from "lucide-react";

export default function DashboardCard({
  icon: Icon,
  title,
  eyebrow,
  children,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800/90 bg-[#101720]/95 p-5 shadow-xl shadow-black/5 transition duration-200 hover:border-blue-500/40 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-xl border border-blue-500/20 bg-blue-600/10 p-2.5 text-blue-400">
          <Icon size={21} />
        </span>
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-semibold text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
