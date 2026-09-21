import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  icon?: LucideIcon;
  children?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  backHref,
  backLabel = "Zurück",
  icon: Icon,
  children,
}: PageHeaderProps) {
  return (
    <header className="page-header relative flex flex-col gap-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--page-accent,var(--color-primary))_12%,var(--color-card)),var(--color-card)_54%,color-mix(in_srgb,var(--color-secondary)_6%,var(--color-card)))] p-5 shadow-[var(--shadow-card)] sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--page-accent,var(--color-primary))_35%,transparent)] bg-[color-mix(in_srgb,var(--page-accent,var(--color-primary))_12%,transparent)] text-[var(--page-accent,var(--color-primary))] shadow-lg">
              <Icon size={21} />
            </span>
          ) : null}
          <h1 className="break-words text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl lg:text-[2.7rem]">
            {title}
          </h1>
        </div>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="grid w-full shrink-0 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center">
          {children}
        </div>
      ) : null}
    </header>
  );
}
