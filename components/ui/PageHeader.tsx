import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">{title}</h1>

        {subtitle && (
          <p className="mt-2 text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {children && (
        <div className="flex items-center">
          {children}
        </div>
      )}
    </div>
  );
}