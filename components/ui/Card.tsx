type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-[1.25rem] border border-slate-800 bg-[#101720]/95 p-6 shadow-2xl shadow-black/10 ${className}`}
    >
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}
