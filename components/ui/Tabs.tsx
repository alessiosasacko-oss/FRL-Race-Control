import Link from "next/link";

export type TabItem = {
  label: string;
  href: string;
  active?: boolean;
  count?: number;
};

export default function Tabs({
  items,
  label = "Ansicht auswählen",
}: {
  items: TabItem[];
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/45 p-1"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
            item.active
              ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          {item.label}
          {item.count !== undefined ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                item.active ? "bg-white/15" : "bg-slate-800"
              }`}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
