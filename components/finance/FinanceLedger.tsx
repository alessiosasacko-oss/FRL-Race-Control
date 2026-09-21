import Link from "next/link";
import { financeTransactionTypeLabels } from "@/domain";
import { formatEuro } from "@/lib/finance/rules";
import type { FinanceTransactionView } from "@/lib/finance/types";

type Props = {
  transactions: FinanceTransactionView[];
  page?: number;
  pages?: number;
  pageHref?: (page: number) => string;
};

function amountClasses(amount: bigint): string {
  return amount >= BigInt(0) ? "text-emerald-300" : "text-rose-300";
}

function Amount({ value }: { value: string }) {
  const amount = BigInt(value);
  return <span className={`font-black tabular-nums ${amountClasses(amount)}`}>{amount > BigInt(0) ? "+" : ""}{formatEuro(amount)}</span>;
}

export default function FinanceLedger({ transactions, page = 1, pages = 1, pageHref }: Props) {
  if (transactions.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">Für diesen Filter liegen noch keine Buchungen vor.</div>;
  }
  return (
    <div className="min-w-0">
      <div className="grid gap-3 lg:hidden">
        {transactions.map((transaction) => (
          <article key={transaction.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.13em] text-slate-500">{financeTransactionTypeLabels[transaction.type]}</p>
                <h3 className="mt-1 break-words font-semibold text-white">{transaction.description}</h3>
              </div>
              <Amount value={transaction.amountEuro} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-slate-500">Rennen</dt><dd className="mt-1 text-slate-300">{transaction.race ? `R${transaction.race.round} · ${transaction.race.name}` : "—"}</dd></div>
              <div><dt className="text-slate-500">Fahrer</dt><dd className="mt-1 text-slate-300">{transaction.driver?.name ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Quelle</dt><dd className="mt-1 text-slate-300">{transaction.source === "AUTOMATIC" ? "Automatisch" : transaction.actor?.displayName ?? "Admin"}</dd></div>
              <div><dt className="text-slate-500">Zeitpunkt</dt><dd className="mt-1 text-slate-300">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(transaction.createdAt))}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-800 lg:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Zeitpunkt</th><th className="px-4 py-3">Buchung</th><th className="px-4 py-3">Rennen / Fahrer</th><th className="px-4 py-3">Quelle</th><th className="px-4 py-3 text-right">Betrag</th></tr></thead>
          <tbody className="divide-y divide-slate-800 bg-[#101720]">
            {transactions.map((transaction) => <tr key={transaction.id}><td className="whitespace-nowrap px-4 py-4 text-slate-400">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(transaction.createdAt))}</td><td className="px-4 py-4"><span className="block font-semibold text-white">{transaction.description}</span><span className="mt-1 block text-xs text-slate-500">{financeTransactionTypeLabels[transaction.type]}</span></td><td className="px-4 py-4 text-slate-300"><span className="block">{transaction.race ? `R${transaction.race.round} · ${transaction.race.name}` : "—"}</span><span className="mt-1 block text-xs text-slate-500">{transaction.driver?.name ?? "Kein Fahrerbezug"}</span></td><td className="px-4 py-4 text-slate-400">{transaction.source === "AUTOMATIC" ? "Automatisch" : transaction.actor?.displayName ?? "Admin"}</td><td className="whitespace-nowrap px-4 py-4 text-right"><Amount value={transaction.amountEuro} /></td></tr>)}
          </tbody>
        </table>
      </div>
      {pages > 1 && pageHref ? <nav aria-label="Ledger-Seiten" className="mt-4 flex items-center justify-between gap-3"><Link aria-disabled={page <= 1} className={`grid min-h-11 place-items-center rounded-xl border px-4 text-sm font-semibold ${page <= 1 ? "pointer-events-none border-slate-800 text-slate-600" : "border-slate-700 text-slate-200 hover:border-blue-500"}`} href={pageHref(Math.max(1, page - 1))}>Zurück</Link><span className="text-sm text-slate-400">Seite {page} von {pages}</span><Link aria-disabled={page >= pages} className={`grid min-h-11 place-items-center rounded-xl border px-4 text-sm font-semibold ${page >= pages ? "pointer-events-none border-slate-800 text-slate-600" : "border-slate-700 text-slate-200 hover:border-blue-500"}`} href={pageHref(Math.min(pages, page + 1))}>Weiter</Link></nav> : null}
    </div>
  );
}
