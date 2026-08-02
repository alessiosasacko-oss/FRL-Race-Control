# Produktionsdatenbank

FRL Race Control verwendet zur Laufzeit auf Vercel ausschließlich den Supabase
Supavisor Transaction Pooler. Dadurch teilen sich kurzlebige Serverless-Instanzen
die Datenbankverbindungen kontrolliert.

## Umgebungsvariablen

- `DATABASE_URL`: Runtime-Verbindung für Next.js und Prisma. Sie muss auf einen
  Supabase-Pooler-Host, Port `6543` und SSL (`sslmode=require` oder strenger)
  zeigen. Die Anwendung verweigert in Production den Start mit einer direkten
  Verbindung oder einem Session-Pooler.
- `DIRECT_URL`: Verbindung für Prisma CLI, `prisma migrate deploy` und andere
  administrative Datenbankwerkzeuge. Der Runtime-Code liest diese Variable
  nicht. `prisma.config.ts` bevorzugt sie weiterhin für CLI-Befehle.

Keine vollständigen Verbindungsstrings, Kennwörter oder Projektschlüssel in
Logs oder Git speichern. Nach jeder Änderung an Vercel Environment Variables ist
ein neues Deployment erforderlich.

## Pool und Region

Pro warmer Node.js-Instanz existieren genau ein `pg`-Pool und ein Prisma Client.
Der Produktionspool ist auf eine Verbindung begrenzt. Timeouts verhindern, dass
fehlgeschlagene Verbindungsversuche dauerhaft Ressourcen belegen.

Der lokal konfigurierte Pooler-Hostname weist auf die Supabase-AWS-Region
`eu-west-1` hin. Das bisherige Vercel-Log aus `iad1` liegt weit davon entfernt.
Die Vercel Function Region sollte im Projekt deshalb nach Prüfung der produktiven
Pooler-URL auf eine möglichst nahe europäische Region (typischerweise Dublin)
gesetzt werden. Die Region wird bewusst nicht im Quellcode erzwungen, damit ein
späterer Supabase-Regionswechsel kein verstecktes Routingproblem erzeugt.

## Betrieb

- Migrationen mit `npx prisma migrate deploy` ausführen.
- Danach den Vercel-Deployment neu starten.
- Pool-Diagnosen enthalten nur Grenzwerte und Zeiten, niemals URLs.
- Lasttests nur lokal oder gegen eine ausdrücklich freigegebene Testumgebung
  durchführen.
