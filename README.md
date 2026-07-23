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
Ligen, Saisons, Teams, Fahrer, Rennen und FIA-Tickets. Das FIA-Race-Control-
Modul liest und schreibt seine Tickets, Beweismetadaten, Diskussionen,
Bewertungen, Entscheidungen, Audit-Einträge und Benachrichtigungen direkt über
Prisma. Binärdateien werden noch nicht gespeichert; Beweise verweisen auf eine
URL und speichern Typ sowie Bezeichnung.

Weitere Datenbankbefehle:

```bash
npm run db:validate
npm run db:generate
npm run db:studio
```

## Discord-Anmeldung

1. Im [Discord Developer Portal](https://discord.com/developers/applications)
   eine OAuth-Anwendung anlegen.
2. Unter OAuth2 die lokale Redirect-URL
   `http://localhost:3000/api/auth/callback/discord` hinterlegen.
3. In `.env` die Werte `AUTH_DISCORD_ID` und `AUTH_DISCORD_SECRET` aus der
   Discord-Anwendung eintragen.
4. Einen sicheren Schlüssel erzeugen und als `AUTH_SECRET` speichern:

```bash
npm exec auth secret
```

`AUTH_URL` muss der öffentlichen Basis-URL der jeweiligen Umgebung entsprechen.
In Produktion ist die Redirect-URL entsprechend mit HTTPS im Discord Developer
Portal zu hinterlegen.

Auth.js speichert Sitzungen in PostgreSQL. Der Browser erhält nur das
zufällige, HTTP-only Session-Token. Neue Discord-Benutzer werden als
`DRIVER` angelegt und können anschließend über die Datenbank einer oder
mehreren Rollen zugeordnet werden.

Geschützte Seiten liegen in `app/(protected)`. `proxy.ts` übernimmt die frühe
Weiterleitung zur Anmeldung; der geschützte Layout- und Datenzugriff prüft die
Sitzung zusätzlich serverseitig.

## Validierung

```bash
npm run lint
npm run typecheck
npm run build
```

`prisma generate`, TypeScript, ESLint und der Produktions-Build benötigen
keine laufende Datenbank. Migrationen, Seed, Prisma Studio und die laufende
Authentifizierung verbinden sich mit PostgreSQL.
