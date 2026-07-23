# frl-race-control

Die offizielle Verwaltungsplattform der F1 Realistic League.

## Entwicklung

```bash
npm install
npm run db:generate
npm run dev
```

Die Anwendung ist anschließend unter [http://localhost:3000](http://localhost:3000) erreichbar.

## Lokale PostgreSQL-Datenbank

Voraussetzungen sind eine lokale PostgreSQL-Instanz und eine leere Datenbank.
Die Anwendung liest die Verbindung ausschließlich aus `DATABASE_URL`.

1. `.env.example` als `.env` kopieren.
2. Benutzername, Passwort, Host, Port und Datenbankname in `DATABASE_URL`
   an die lokale PostgreSQL-Instanz anpassen.
3. Das initiale Datenbankschema erzeugen und die vorhandenen
   Entwicklungsdaten importieren:

```bash
npm run db:migrate
npm run db:seed
```

Der Seed ist wiederholbar und verwendet die bestehenden Fixture-Daten für
Ligen, Saisons, Teams, Fahrer, Rennen und FIA-Tickets. Die aktuelle UI liest
weiterhin aus diesen Fixtures; in Phase 3 werden noch keine Datenbankabfragen
in Seiten oder Komponenten ausgeführt.

Weitere Datenbankbefehle:

```bash
npm run db:validate
npm run db:generate
npm run db:studio
```

## Validierung

```bash
npm run lint
npm run typecheck
npm run build
```

`prisma generate`, TypeScript, ESLint und der Produktions-Build benötigen
keine laufende Datenbank. Nur Migrationen, Seed und Prisma Studio verbinden
sich mit PostgreSQL.
