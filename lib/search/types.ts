export type GlobalSearchResult = {
  id: string;
  kind: "driver" | "team" | "race" | "season";
  title: string;
  subtitle: string;
  href: string;
};
