type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`surface-panel p-6 ${className}`}
    >
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-[var(--color-text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
