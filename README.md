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
Die Anwendung liest die Laufzeitverbindung aus `DATABASE_URL`. Wenn
`DIRECT_URL` gesetzt ist, verwendet Prisma CLI diese direkte Verbindung für
Migrationen; andernfalls wird ebenfalls `DATABASE_URL` verwendet. `.env.local`
wird vor `.env` geladen.

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
Prisma. Externe Beweislinks bleiben möglich. Hochgeladene Videos werden in
einem privaten Supabase-Storage-Bucket gespeichert; PostgreSQL enthält nur die
zugehörigen Metadaten.

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

Nach einer Änderung von `AUTH_SECRET`, `AUTH_URL` oder der Session-Datenbank
kann ein altes localhost-Session-Cookie ungültig sein. In diesem Fall die
Cookies für `localhost` im Browser manuell löschen und erneut über Discord
anmelden. Die Anwendung löscht Auth-Cookies nicht automatisch.

Geschützte Seiten liegen in `app/(protected)`. `proxy.ts` übernimmt die frühe
Weiterleitung zur Anmeldung; der geschützte Layout- und Datenzugriff prüft die
Sitzung zusätzlich serverseitig.

## Private FIA-Video-Beweise mit Supabase Storage

1. Im Supabase-Dashboard einen Bucket mit dem Namen aus
   `SUPABASE_STORAGE_BUCKET` anlegen, beispielsweise `fia-evidence`.
2. Den Bucket **privat** belassen. Als Bucket-Limits mindestens dieselben
   erlaubten MIME-Typen und dieselbe maximale Dateigröße wie in der
   Anwendung konfigurieren.
3. `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` ausschließlich in der
   Server-Umgebung setzen. Der Service-Role-Key darf niemals eine
   `NEXT_PUBLIC_`-Variable sein oder an den Browser übertragen werden.
4. Die konfigurierbaren Anwendungsgrenzen setzen:

```dotenv
SUPABASE_STORAGE_BUCKET="fia-evidence"
FIA_EVIDENCE_MAX_FILE_SIZE_MB="100"
FIA_EVIDENCE_MAX_FILES="3"
FIA_EVIDENCE_ALLOWED_MIME_TYPES="video/mp4,video/quicktime,video/webm"
FIA_EVIDENCE_SIGNED_URL_TTL_SECONDS="300"
```

Der Server authentifiziert und autorisiert jeden Upload, erstellt anschließend
eine kurzlebige signierte Upload-URL und prüft nach der Übertragung Dateigröße,
gespeicherten MIME-Typ und Binärsignatur. Ansichten laufen ebenfalls über eine
autorisierte App-Route, die nur kurzlebige signierte Download-URLs ausstellt.
Es gibt keine öffentlichen Objekt-URLs und keine direkte Browser-Verwendung
des Service-Role-Keys.

Abgebrochene, noch keinem Ticket zugeordnete Uploads werden über die App wieder
entfernt. Das Löschen eines Beweises oder des zugehörigen Tickets erzeugt
transaktional einen dauerhaften Storage-Cleanup-Auftrag. Die App versucht ihn
direkt auszuführen; der tägliche Bereinigungsjob wiederholt fehlgeschlagene
Löschungen.

## Benachrichtigungen und E-Mail

Das Notification Center speichert ungelesene, gelesene und archivierte
Benachrichtigungen in PostgreSQL. Benutzer konfigurieren In-App- und
E-Mail-Kategorien sowie Ruhezeiten unter `/settings`.

E-Mails werden zuerst zuverlässig in `EmailDelivery` abgelegt. Ein geplanter
Job ruft anschließend den geschützten Endpunkt auf:

```bash
curl -X POST \
  -H "Authorization: Bearer $EMAIL_CRON_SECRET" \
  http://localhost:3000/api/notifications/email
```

Der Job erzeugt außerdem idempotente Hinweise für geöffnete, bald schließende
und geschlossene Rennanmeldungen. Für die SMTP-Zustellung werden `SMTP_URL`,
`EMAIL_FROM` und `EMAIL_CRON_SECRET` benötigt. Ohne SMTP-Konfiguration bleibt
die Anwendung einschließlich Production Build vollständig lauffähig; es wird
lediglich keine Outbox verarbeitet.

## Discord-Bot und Automation

Phase 9 verwendet Discord.js und eine persistente `DiscordDelivery`-Outbox.
Dadurch werden Discord-API-Aufrufe niemals innerhalb einer fachlichen
Datenbanktransaktion ausgeführt. Kanal- und Rollenzuordnungen werden unter
`/admin/automation` konfiguriert.

1. Im Discord Developer Portal für den Bot den **Server Members Intent**
   aktivieren.
2. Den Bot mit den Rechten zum Anzeigen von Kanälen, Senden von Nachrichten,
   Einbetten von Links und Verwalten von Rollen zum FRL-Server einladen.
3. `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` und `INTERNAL_API_SECRET` in `.env` setzen. Die Kanalmatrix lädt sichtbare Text- und Announcement-Kanäle ausschließlich serverseitig; der Bot benötigt pro Zielkanal `View Channel`, `Send Messages` und `Attach Files`.
4. Bot und Worker als langlebigen Prozess starten:

```bash
npm run bot:start
```

Alternativ kann ein externer Scheduler die fälligen Jobs ausführen:

```bash
curl -X POST \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  http://localhost:3000/api/internal/automation/run
```

Ein einzelner Lauf ist lokal auch mit `npm run automation:run` möglich.
Automationsjobs besitzen Sperren, Run-Historie, exponentielle Wiederholung und
eine manuelle Retry-Funktion. Die Standardjobs verarbeiten Rennanmeldungs- und
Rennwochenend-Erinnerungen, Meisterschaftsprüfungen, Bereinigungen, E-Mail- und
Discord-Outboxes, Mystery-Race-Veröffentlichungen, Statistiken, geplante
Mitteilungen und Discord-Rollen.

Interne Webhook-Ereignisse können idempotent an
`POST /api/internal/webhooks` übergeben werden. Status- und Sync-Endpunkte
unter `/api/internal/status` und `/api/internal/discord/sync` verwenden
dasselbe Bearer-Secret. Secrets werden nicht in der Datenbank gespeichert.

Ankündigungen werden unter `/admin/announcements` für App, Discord, E-Mail oder
alle Ziele geplant. E-Mail- und Discord-Zustellung bleiben ohne konfigurierte
externe Dienste aus, während TypeScript, Lint und Production Build keine
Netzwerk- oder Datenbankverbindung benötigen.

## Validierung

```bash
npm run lint
npm run typecheck
npm run build
```

`prisma generate`, TypeScript, ESLint und der Produktions-Build benötigen
keine laufende Datenbank. Migrationen, Seed, Prisma Studio und die laufende
Authentifizierung verbinden sich mit PostgreSQL.
