type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <section className="empty-state rounded-[var(--radius-card)] border border-dashed px-5 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400">
          {icon}
        </div>
      ) : null}
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
