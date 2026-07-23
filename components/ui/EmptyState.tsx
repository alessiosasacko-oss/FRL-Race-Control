type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-10 text-center">
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-slate-400">{description}</p>
    </section>
  );
}
