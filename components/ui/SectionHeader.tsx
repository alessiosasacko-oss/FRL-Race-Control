import type { LucideIcon } from "lucide-react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

export default function SectionHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  action,
}: SectionHeaderProps) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <div className="flex items-center gap-2.5">
          {Icon ? <Icon className="text-blue-400" size={20} /> : null}
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
