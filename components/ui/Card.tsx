type CardProps = {
  title: string;
  children: React.ReactNode;
};

export default function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-red-600 hover:shadow-2xl">
      <h2 className="mb-4 text-2xl font-bold tracking-wide text-red-500">
        {title}
      </h2>

      {children}
    </div>
  );
}