# FRL Mobile API v1

Die öffentliche Mobile API ist der einzige Datenzugang der separaten React-Native-App. Sie liest aus derselben Datenbank wie FRL Race Control, gibt aber ausschließlich explizit serialisierte öffentliche Felder aus.

Basis-Pfad: `/api/mobile/v1`

Die öffentlichen Endpunkte bleiben ohne Anmeldung lesbar. Die getrennte Mobile-Authentifizierung und der persönliche `/me`-Endpunkt sind in [mobile-auth-v1.md](./mobile-auth-v1.md) dokumentiert. Für kontrollierte Browserentwicklung wird `OPTIONS` unterstützt; Browser-Origin-Freigaben kommen aus `MOBILE_API_ALLOWED_ORIGINS`. Native Apps benötigen normalerweise kein CORS.

## Endpunkte

| Methode | Pfad | Parameter | Zweck |
| --- | --- | --- | --- |
| GET | `/health` | keine | Dienststatus ohne Datenbank- oder Konfigurationsdetails |
| GET | `/bootstrap` | keine | App-Grundkonfiguration, aktive Ligen und aktive Saisons |
| GET | `/leagues` | keine | aktive öffentliche Ligen, veröffentlichte Rennen und nächstes Rennen |
| GET | `/calendar` | `league`, `seasonId` | öffentlicher Rennkalender |
| GET | `/championship` | `league`, `seasonId`, `type` | Fahrer-WM oder TCWM / Team-WM |
| GET | `/results` | `league`, `seasonId`, `limit`, `cursor` | veröffentlichte Ergebnisübersichten |
| GET | `/results/{raceId}` | optional `league` | veröffentlichte Sessions eines Rennens |
| GET/POST | `/auth/*` | PKCE, App-Code oder Token | sicherer nativer Discord-Login und Token-Lebenszyklus |
| GET | `/me` | Mobile Bearer Token | minimiertes persönliches App-Profil |

`league` ist ein Liga-Code wie `F1` oder `F2`. Ohne Angabe wird `F1` verwendet, sofern diese Liga aktiv ist; andernfalls die erste aktive Liga nach Anzeige-Reihenfolge. `seasonId` muss eine positive Ganzzahl und der Liga zugeordnet sein. Ohne Saison wird die aktive Saison der Liga gewählt. `type` akzeptiert nur `DRIVERS` und `TEAMS` und ist standardmäßig `DRIVERS`. `limit` ist positiv und wird auf maximal 50 begrenzt; der Standard ist 20. `cursor` ist die vom vorherigen Aufruf gelieferte positive Race-ID.

Unbekannte Parameter und syntaktisch ungültige Werte ergeben HTTP 400. Nicht vorhandene bzw. der Liga nicht zugeordnete Ressourcen ergeben HTTP 404.

## Antwortformat

Listen verwenden ein gemeinsames Format:

```json
{
  "data": [],
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-08-04T12:00:00.000Z",
    "league": "F2",
    "seasonId": 123,
    "nextCursor": null
  }
}
```

Einzelressourcen verwenden `data` als Objekt. Health und Bootstrap sind bewusst direkte Konfigurationsantworten entsprechend ihrem festen Startvertrag.

Fehler enthalten weder Stacktraces noch Datenbankdetails:

```json
{
  "error": {
    "code": "LEAGUE_NOT_FOUND",
    "message": "Die angeforderte Liga wurde nicht gefunden."
  }
}
```

## Health

```json
{
  "ok": true,
  "service": "frl-mobile-api",
  "version": "v1",
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

Der Endpunkt prüft absichtlich keine Datenbankverbindung und gibt keine Umgebungsvariablen, Zugangsdaten oder internen Fehler aus.

## Bootstrap

```json
{
  "apiVersion": "v1",
  "serverTime": "2026-08-04T12:00:00.000Z",
  "defaultLeague": "F1",
  "minimumSupportedAppVersion": "1.0.0",
  "maintenance": {
    "enabled": false,
    "message": null
  },
  "leagues": [
    {
      "id": 1,
      "code": "F1",
      "name": "Formula 1",
      "activeSeason": {
        "id": 10,
        "name": "Season 12"
      }
    }
  ],
  "features": {
    "calendar": true,
    "results": true,
    "driverChampionship": true,
    "teamChampionship": true,
    "authentication": true,
    "attendance": false,
    "fia": false
  }
}
```

Die vorbereiteten Einstellungen verwenden ausschließlich die dafür vorgesehenen Variablen `MOBILE_API_MIN_APP_VERSION`, `MOBILE_API_MAINTENANCE_MODE` und `MOBILE_API_MAINTENANCE_MESSAGE`. Andere Umgebungsvariablen werden nie gespiegelt.

## Ligen und Kalender

`/leagues` liefert nur Datensätze mit aktivem Liga-Flag. Das vorhandene Datenmodell besitzt kein separates Public-Visibility-Feld; für v1 ist das aktive Liga-Flag deshalb die bestehende öffentliche Freigaberegel. Pro Liga werden Branding-Farbe, aktive Saison, Anzahl unterschiedlicher Rennen mit mindestens einer veröffentlichten Session und das nächste liga-spezifisch terminierte Rennen ausgegeben.

Ein Kalendereintrag enthält Liga, Saison, Runde, Name, Strecke, Land, ISO-Ländercode, Datum, Startzeit, Zeitzone, Format, Sprint-Kennzeichnung, Sessions, Status, Veröffentlichungsstatus und öffentliche Streckenfakten.

Die bestehende Mystery-Logik aus `lib/races/visibility.ts` wird wiederverwendet. Vor dem Reveal wird keine Strecke über Name, Land, Layout oder sonstige Streckenmetadaten verraten:

```json
{
  "isMysteryRace": true,
  "mysteryRevealed": false,
  "name": "Mystery Race",
  "circuit": null,
  "country": null,
  "countryCode": null,
  "track": null,
  "revealAt": "2026-08-09T17:00:00.000Z"
}
```

Der HTTP-Cache eines noch verdeckten Mystery-Rennens endet mindestens eine Sekunde vor `revealAt` und verwendet kein `stale-while-revalidate` über den Reveal-Zeitpunkt.

## Fahrer-WM und TCWM / Team-WM

Beispiele:

- `/championship?league=F2&type=DRIVERS`
- `/championship?league=F2&seasonId=123&type=TEAMS`

Die API ruft die bestehende Championship-Query auf und serialisiert die bereits gespeicherten `DriverStanding`- bzw. `TeamStanding`-Werte. Punkte, Siege und Podien werden nicht in der API neu berechnet. Eine Positionsveränderung wird als `null` ausgegeben, solange keine belastbare historische Vergleichsbasis vorhanden ist.

Fahrerantworten enthalten nur öffentliche Fahrer-ID, Anzeigename, Nummer, Flagge, Team, Logo, Punkte, Siege, Podien und Ersatzfahrer-Kennzeichnung. Teamantworten enthalten nur öffentliche Team-ID, Name, Logo, Punkte und Siege.

## Ergebnisse

`/results` fragt ausschließlich Rennen mit mindestens einer `PUBLISHED`-Session der gewählten Liga ab. Entwurfssessions werden zusätzlich im Serializer verworfen. `meta.nextCursor` enthält bei einer weiteren Seite den Cursor, sonst `null`.

Die Übersicht enthält veröffentlichte Sessions, Session-Flags, Gewinner des Hauptrennens, Gewinnerteam und die neueste fertig gerenderte öffentliche Rennergebnisgrafik.

`/results/{raceId}` verwendet die bestehende öffentliche Ergebnisabfrage ohne Draft-Modus. Es werden Qualifying, Sprint und Rennen in fachlicher Reihenfolge ausgegeben, sofern die jeweilige Session veröffentlicht ist. Ergebniszeilen enthalten Position, Fahrer, Nummer, Flagge, Team, Status, strukturierte Zeit-/Abstandswerte, Punkte, schnellste Runde und den bereits öffentlich wirksamen Zeitstrafen-/DSQ-Ausgang. FIA-Ticket-IDs, Beweise, interne Strafgründe, Draft-Payloads und Adminnotizen werden nicht serialisiert.

## Fehlercodes

| HTTP | Code | Bedeutung |
| --- | --- | --- |
| 400 | `INVALID_QUERY` | Parameter oder Race-ID ungültig |
| 404 | `LEAGUE_NOT_FOUND` | aktive Liga nicht vorhanden |
| 404 | `SEASON_NOT_FOUND` | Saison nicht vorhanden oder der Liga nicht zugeordnet |
| 404 | `RACE_NOT_FOUND` | Rennen nicht vorhanden |
| 404 | `RESULT_NOT_FOUND` | keine veröffentlichte Session vorhanden |
| 429 | `RATE_LIMITED` | öffentliches Leselimit überschritten |
| 500 | `INTERNAL_ERROR` | sicher abstrahierter interner Fehler |

## Sicherheit, Rate Limit und Cache

Alle Antworten werden über explizite DTO-Serializer aufgebaut und anschließend JSON-sicher normalisiert. Datumswerte sind ISO-Strings; BigInt- und Decimal-Werte werden als Strings serialisiert. Der Client erhält nie Prisma-Objekte direkt.

Ausgeschlossen sind insbesondere Datenbank- und Auth-Secrets, E-Mail- und IP-Adressen, Discord-IDs, Rollen, Benutzer-IDs aus der Auth-Domain, Rennanmeldungen, FIA-Tickets, Beweise, Steward-Kommentare, interne Notizen und unveröffentlichte Ergebnisse. Die React-Native-App benötigt keine direkte Supabase-Verbindung.

Das bestehende serverseitige Rate Limit wird pro Endpunkt und gehashtem Client-Fingerprint mit 120 Anfragen pro Minute verwendet. Bei Überschreitung folgen HTTP 429 und `Retry-After`. Bootstrap, Ligen, Kalender und Wertungen werden 30 bis 60 Sekunden cachebar ausgeliefert; Health und Fehler sind `no-store`.

## Authentifizierung und nächste Phase

Der serververmittelte Discord-Login, der getrennte Mobile-Token-Lebenszyklus und `/me` sind Bestandteil von v1. Persönliche Rennanmeldung und berechtigte FIA-Schreibfunktionen bleiben einer späteren Phase vorbehalten und müssen die zentrale Mobile-Session- und Berechtigungsprüfung wiederverwenden.
