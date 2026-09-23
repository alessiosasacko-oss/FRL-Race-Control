# Dokumentierte Finance-Regeln

- Ein Finance-Konto gehört genau einer kanonischen `TeamOrganization`. Die
  technischen `Team`-Datensätze für Liga und Saison sind ausschließlich
  Herkunftsmetadaten der Buchung. Liga-, Saison-, Renn-, Fahrer- und
  Buchungstyp-Filter schränken deshalb nur das Journal ein und ändern niemals
  den globalen Kontostand.
- Der automatische Startwert wird beim ersten Anlegen der Organisation genau
  einmal gebucht. Rennen aus verschiedenen Ligen sowie Saisonprämien buchen in
  dasselbe Konto. Die Teilnahmegebühr verwendet den globalen Kontostand vor
  der jeweiligen Settlement-Transaktion.
- `DriverLineupStatus.PRIMARY` ist im bestehenden FRL-Datenmodell die
  Kennzeichnung für **SF / Stammfahrer**. Die Administration bezeichnet
  `PRIMARY` durchgehend als `Stammfahrer` und `SUBSTITUTE` als `Ersatzfahrer`.
  Die Superlizenz-Abrechnung verwendet deshalb diese vorhandene Kennzeichnung
  und keine zusätzliche Heuristik.
- Die aktuelle technische Regel berechnet die Teilnahmegebühr von 1,5 % nur
  auf einen positiven Opening Balance. Bei einem Opening Balance von null oder
  weniger beträgt die Teilnahmegebühr daher 0 EUR. Negative Kontostände bleiben
  erlaubt. Diese Dokumentation ändert die Regel nicht.
