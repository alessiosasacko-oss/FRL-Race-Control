# Globale Teamidentität und Legacy-Slots

Seit der Migration `20260801170000_global_team_identity` ist
`TeamOrganization` die einzige sichtbare Teamidentität. Das Prisma-Modell
`Team` bleibt ausschließlich als technischer Saison-/Liga-Slot bestehen, weil
historische Ergebnisse, Anmeldungen, Wertungen und Anpassungen weiterhin auf
diese stabilen Fremdschlüssel verweisen.

Die additive Migration:

- markiert alle bereits mit einer Organisation verknüpften `Team`-Datensätze
  als systemverwaltet;
- übernimmt vorhandene Branding-Daten deterministisch aus dem ältesten
  verknüpften Slot;
- vergibt einen eindeutigen Slot-Schlüssel für die jeweils älteste vorhandene
  Kombination aus Team, Saison und Liga;
- lässt unerwartete Dubletten sowie unabhängige, nicht verknüpfte Legacy-Teams
  unverändert, statt Namen automatisch zu erraten;
- löscht oder verschiebt keine Ergebnisse, Teamwertungen, FIA-Daten,
  Anmeldungen oder Fahrerhistorien.

Neue technische Slots entstehen ausschließlich über
`ensureInternalTeamSlot({ organizationId, seasonId, leagueId })`. Die Funktion
verwendet die globalen Namen, Kürzel und Farben, setzt keinen eigenen Teamchef
und ist über den stabilen Slot-Schlüssel idempotent.

Vor einer späteren Bereinigung unerwarteter Dubletten müssen deren abhängige
Fremdschlüssel einzeln geprüft und gezielt auf einen kanonischen Slot migriert
werden. Diese Migration nimmt bewusst keine solche fachliche Zuordnung vor.
