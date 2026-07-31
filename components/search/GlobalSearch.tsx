"use client";

import {
  CalendarDays,
  Flag,
  Search,
  Shield,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GlobalSearchResult } from "@/lib/search/types";

const kindConfig = {
  driver: { label: "Fahrer", icon: UserRound },
  team: { label: "Team", icon: Users },
  race: { label: "Rennen", icon: Flag },
  ticket: { label: "FIA", icon: Shield },
  season: { label: "Saison", icon: Trophy },
} as const;

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("SEARCH_FAILED");
        const payload = (await response.json()) as {
          results: GlobalSearchResult[];
        };
        setResults(payload.results);
      } catch (error: unknown) {
        if (
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function navigate(href: string): void {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function updateQuery(value: string): void {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-3 rounded-xl border border-slate-800 bg-[#151B24] px-4 py-2 text-sm text-slate-400 transition hover:border-blue-500 hover:text-white lg:flex"
      >
        <Search size={18} />
        <span className="xl:min-w-36 xl:text-left">Global suchen</span>
        <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        aria-label="Global suchen"
        onClick={() => setOpen(true)}
        className="mobile-touch-target rounded-xl bg-[#151B24] p-3 transition hover:bg-blue-600 lg:hidden"
      >
        <Search size={20} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Globale Suche"
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0F141B] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4">
              <Search size={20} className="text-blue-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Fahrer, Teams, Rennen, FIA-Tickets oder Saisons"
                className="min-w-0 flex-1 bg-transparent py-5 text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Suche schließen"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-slate-800/70"
                    />
                  ))}
                </div>
              ) : null}
              {!loading &&
                results.map((result) => {
                  const config = kindConfig[result.kind];
                  const Icon = config.icon;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => navigate(result.href)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-600/15"
                    >
                      <span className="rounded-lg bg-slate-800 p-2 text-blue-400">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white">
                          {result.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-400">
                          {result.subtitle}
                        </span>
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500">
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              {!loading && query.trim().length < 2 ? (
                <div className="py-12 text-center text-slate-400">
                  <CalendarDays className="mx-auto mb-3 text-slate-600" />
                  Mindestens zwei Zeichen eingeben.
                </div>
              ) : null}
              {!loading &&
              query.trim().length >= 2 &&
              results.length === 0 ? (
                <p className="py-12 text-center text-slate-400">
                  Keine passenden Ergebnisse.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
