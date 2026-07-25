export type GlobalSearchResult = {
  id: string;
  kind: "driver" | "team" | "race" | "ticket" | "season";
  title: string;
  subtitle: string;
  href: string;
};
