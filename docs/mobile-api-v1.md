# FRL Mobile API v1

Die Mobile API ist der einzige Datenzugang der separaten React-Native-App. Öffentliche Endpunkte geben ausschließlich explizit serialisierte öffentliche Felder aus; persönliche Attendance-Endpunkte benötigen einen gültigen Mobile Access Token und liefern ausschließlich Daten des authentifizierten Fahrers.

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
| GET | `/attendance` | Mobile Bearer Token; `seasonId`, `status`, `upcoming` optional | eigene relevante Rennanmeldungen |
| GET | `/attendance/{raceId}` | Mobile Bearer Token | eigene Anmeldung und Rennfensterdetails |
| PUT | `/attendance/{raceId}` | Mobile Bearer Token; JSON-Status | eigene Teilnahme an- oder abmelden |

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
    "attendance": true,
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

## Persönliche Rennanmeldung

Alle Attendance-Endpunkte erwarten den Header:

```http
Authorization: Bearer <mobile-access-token>
```

Der Access Token wird zentral durch `requireMobileUser(request)` geprüft. Benutzer, Fahrerprofil, Liga, Saisonzuordnung und Rollen werden danach aktuell aus der Datenbank bestimmt. Requests dürfen keine `userId`, `driverId`, `leagueId`, `teamId`, Rollen, Quelle oder Ersatzfahrer-ID enthalten. Unbekannte Felder werden abgewiesen. Die Teamchef- und Ersatzfahrerverwaltung bleibt in v1 Web-only; ein mobiler Fahrer ändert ausschließlich den eigenen Status. Bereits administrativ hinterlegte Ersatzfahrerinformationen werden dem betroffenen Fahrer angezeigt, durch Mobile-Requests aber weder ausgewählt noch entfernt.

### Übersicht

`GET /attendance` wählt standardmäßig die aktuelle aktive Saison der Liga des eigenen aktiven Fahrerprofils. Es werden maximal 40 liga-spezifische Termine vom jüngsten 30-Tage-Zeitraum bis 180 Tage in die Zukunft ausgegeben. `upcoming=true` begrenzt auf noch nicht gestartete Termine. `seasonId` ist nur zulässig, wenn eine aktive Fahrer-Saison-Zuordnung in der eigenen Liga existiert. `status` filtert stabil nach `SCHEDULED`, `IN_PROGRESS`, `COMPLETED` oder `CANCELLED`.

Jeder Eintrag enthält Renn-, Liga- und Saisondaten, öffentlich sichtbare Strecke, Mystery-Status, liga-spezifische Startzeit, Öffnung und Schluss des Anmeldefensters, Fensterstatus, eigenen Attendance-Status, letzte Änderung, Quelle, Antwortmöglichkeit, veröffentlichtes Ergebnis, Absage- und Sprint-Flags sowie gegebenenfalls die eigene Ersatzfahrerzuordnung. Ohne vorhandene Antwort ist `status` ausschließlich lesend `NO_RESPONSE`.

### Einzelnes Rennen

```http
GET /api/mobile/v1/attendance/123
Authorization: Bearer <mobile-access-token>
```

Zusätzlich zur Übersicht enthält die Antwort das minimierte eigene Fahrerprofil, `remainingSeconds`, `availableResponses`, `canChange`, den eigenen Ersatzfahrer beziehungsweise eine bestehende Einteilung als Ersatzfahrer. Normale Fahrer erhalten keine Attendance-Listen anderer Fahrer. Eine fremde oder nicht zur eigenen Liga gehörende Race-ID liefert keine fremden Renndaten.

Das vorhandene Datenmodell besitzt kein separates fachliches Öffnungsfeld. Die Web-App betrachtet einen liga-spezifischen Rennplan unmittelbar nach seiner Erstellung als geöffnet. Deshalb ist `opensAt` konsistent dazu `RaceLeagueSchedule.createdAt`; `closesAt` ist `attendanceDeadline`. Eine additive Migration ist hierfür nicht erforderlich.

Stabile Fensterzustände kommen vollständig vom Backend:

| Status | Bedeutung |
| --- | --- |
| `NOT_OPEN` | Die Rennanmeldung ist noch nicht geöffnet. |
| `OPEN` | Der Fahrer kann jetzt antworten. |
| `CLOSED` | Der Anmeldeschluss ist abgelaufen. |
| `RACE_STARTED` | Der liga-spezifische Rennstart ist erreicht oder das Rennen läuft/ist beendet. |
| `RACE_CANCELLED` | Das Rennen wurde abgesagt. |

### Status ändern

```http
PUT /api/mobile/v1/attendance/123
Authorization: Bearer <mobile-access-token>
Content-Type: application/json

{
  "status": "REGISTERED"
}
```

Alternativ ist ausschließlich `DECLINED` zulässig. `NO_RESPONSE` kann nicht aktiv gesendet werden. Eine identische Wiederholung ist idempotent: Sie liefert den aktuellen Zustand mit `changed: false` zurück und erzeugt weder weiteren Audit-Eintrag noch Notification oder Webhook-Ereignis.

Echte Änderungen laufen in einer kurzen serialisierbaren Datenbanktransaktion und verwenden dieselbe zentrale Attendance-Logik wie die Web-Action. Gespeichert werden RaceAttendance, AttendanceAudit, ChampionshipAudit `ATTENDANCE_CHANGED`, Systemaudit, Webhook-Ereignis und notwendige interne Notifications. Die Quelle wird serverseitig als `DRIVER` bestimmt. Die Mobile-Bestätigung ist In-App-only; sie erzeugt keine einzelne Discord-Nachricht. Danach werden Attendance-, Kalender-, Championship-, Dashboard- und Notification-Ansichten invalidiert beziehungsweise per bestehender Datenrevision aktualisiert.

Erfolgsbeispiel (gekürzt):

```json
{
  "data": {
    "raceId": 123,
    "status": "REGISTERED",
    "statusLabel": "Angemeldet",
    "canRespond": true,
    "windowStatus": "OPEN",
    "changedAt": "2026-08-05T12:00:00.000Z",
    "changeSource": "DRIVER",
    "changed": true
  },
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-08-05T12:00:00.000Z"
  }
}
```

Mystery-Rennen verwenden unverändert `lib/races/visibility.ts` und denselben Serializer wie der öffentliche Kalender. Vor dem Reveal bleiben Name, Rundkurs, Land, Layout und sämtliche Streckenmetadaten verborgen; auch Notifications verwenden dann nur den öffentlichen Mystery-Namen.

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
| 400 | `INVALID_ATTENDANCE_STATUS` | nur `REGISTERED` oder `DECLINED` erlaubt |
| 401 | `AUTH_REQUIRED` | Mobile Bearer Token fehlt oder ist ungültig |
| 403 | `USER_INACTIVE` | Benutzer ist deaktiviert |
| 403 | `USER_LOCKED` | Benutzer ist gesperrt |
| 403 | `DRIVER_PROFILE_REQUIRED` | aktives Fahrerprofil fehlt |
| 403 | `DRIVER_NOT_ASSIGNED` | aktive Liga-/Saisonzuordnung fehlt |
| 403 | `LEAGUE_MISMATCH` | Rennen und Fahrerprofil gehören nicht zusammen |
| 404 | `RACE_NOT_FOUND` | Rennen ist für den Fahrer nicht verfügbar |
| 409 | `RACE_CANCELLED` | Rennen wurde abgesagt |
| 409 | `ATTENDANCE_NOT_OPEN` | Fenster ist noch nicht geöffnet |
| 409 | `ATTENDANCE_CLOSED` | Anmeldeschluss ist abgelaufen |
| 409 | `RACE_ALREADY_STARTED` | liga-spezifischer Rennstart ist erreicht |
| 429 | `RATE_LIMITED` | Attendance-Limit überschritten |
| 500 | `ATTENDANCE_UPDATE_FAILED` | sicher abstrahierter Speicherfehler |

## Sicherheit, Rate Limit und Cache

Alle Antworten werden über explizite DTO-Serializer aufgebaut und anschließend JSON-sicher normalisiert. Datumswerte sind ISO-Strings; BigInt- und Decimal-Werte werden als Strings serialisiert. Der Client erhält nie Prisma-Objekte direkt.

Ausgeschlossen sind insbesondere Datenbank- und Auth-Secrets, E-Mail- und IP-Adressen, Discord-IDs, fremde Rennanmeldungen, FIA-Tickets, Beweise, Steward-Kommentare, interne Notizen und unveröffentlichte Ergebnisse. Die React-Native-App benötigt keine direkte Supabase-Verbindung.

Das bestehende serverseitige Rate Limit wird pro Endpunkt und gehashtem Client-Fingerprint verwendet. Öffentliche Endpunkte bleiben bei 120 Anfragen pro Minute; persönliche Attendance-Lesezugriffe sind auf 60 pro Minute und Änderungen auf 20 pro zehn Minuten begrenzt. Bei Überschreitung folgen HTTP 429 und `Retry-After`. Bootstrap, Ligen, Kalender und Wertungen werden 30 bis 60 Sekunden cachebar ausgeliefert. Persönliche Attendance-Antworten, Health und Fehler sind `private, no-store` und werden nie benutzerübergreifend gecacht.

## Authentifizierung und nächste Phase

Der serververmittelte Discord-Login, der getrennte Mobile-Token-Lebenszyklus, `/me` und die Fahrer-Selbstanmeldung sind Bestandteil von v1. Mobile Teamchef-, Ersatzfahrer- und FIA-Schreibfunktionen bleiben späteren Phasen vorbehalten und müssen die zentrale Mobile-Session- und Berechtigungsprüfung wiederverwenden.
