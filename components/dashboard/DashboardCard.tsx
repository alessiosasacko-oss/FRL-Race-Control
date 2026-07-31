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
      className={`surface-panel dashboard-card p-5 transition duration-200 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-xl border border-[color-mix(in_srgb,var(--page-accent,var(--color-primary))_25%,transparent)] bg-[color-mix(in_srgb,var(--page-accent,var(--color-primary))_12%,transparent)] p-2.5 text-[var(--page-accent,var(--color-primary))]">
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
