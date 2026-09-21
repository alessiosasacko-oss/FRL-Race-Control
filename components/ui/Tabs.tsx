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
      className="inline-flex max-w-full gap-0 overflow-x-auto border border-slate-800 bg-slate-950/45"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition ${
            item.active
              ? "border-blue-400 bg-blue-500/10 text-white"
              : "border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"
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
