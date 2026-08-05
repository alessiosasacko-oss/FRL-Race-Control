# FRL Mobile Authentication v1

Die native FRL-Race-Control-App authentifiziert sich über einen serververmittelten Discord-OAuth-Ablauf. Discord-Client-Secret, Bot-Token, Auth.js-Secret, Datenbankzugang und `MOBILE_AUTH_SECRET` verbleiben ausschließlich in der Next.js-Web-App. Die Mobile-App erhält weder Discord-Tokens noch Auth.js-Sitzungstokens.

Die bestehende Auth.js-Web-Anmeldung bleibt separat unter `/api/auth/*`. Ihr Discord-Callback ist `/api/auth/callback/discord`; der mobile Callback ist ausschließlich `/api/mobile/v1/auth/discord/callback`. Mobile Sitzungen werden in eigenen Tabellen geführt und Logout verändert keine Web-Sitzung oder Account-Verknüpfung.

## Voraussetzungen

Serverseitige Variablen:

```dotenv
AUTH_DISCORD_ID="discord-application-id"
AUTH_DISCORD_SECRET="discord-client-secret"
MOBILE_AUTH_SECRET="at-least-32-cryptographically-random-bytes"
```

`MOBILE_AUTH_SECRET` signiert ausschließlich Mobile-Access-Tokens. Der Wert muss mindestens 32 zufällige Bytes enthalten, darf weder mit `EXPO_PUBLIC_` beginnen noch an Browser oder App ausgeliefert oder protokolliert werden. Er ist unabhängig von `AUTH_SECRET`.

Im Discord Developer Portal muss zusätzlich exakt folgende Redirect-URL für dieselbe Discord-Anwendung eingetragen werden:

```text
https://frl-race-control.vercel.app/api/mobile/v1/auth/discord/callback
```

Der native App-Redirect ist fest auf folgenden Wert begrenzt:

```text
frlracecontrol://auth/callback
```

Andere HTTPS-Ziele, fremde Schemes, `javascript:`, `data:`, Subdomains oder aus Headern abgeleitete Ziele werden abgewiesen.

## Ablauf

1. Die App erzeugt mit einem kryptografisch sicheren Zufallszahlengenerator einen PKCE Code Verifier mit 43 bis 128 RFC-7636-Zeichen.
2. Sie bildet `BASE64URL(SHA256(codeVerifier))` als Code Challenge und erzeugt einen unabhängigen zufälligen `clientState`.
3. Sie öffnet `GET /api/mobile/v1/auth/discord/start` im Systembrowser.
4. Das Backend validiert Redirect-URI und `S256`, erzeugt einen eigenen zufälligen OAuth-State und speichert ausschließlich dessen SHA-256-Hash zusammen mit Challenge, `clientState`, Redirect und Ablaufzeit.
5. Das Backend leitet zu Discord weiter und fordert nur den Scope `identify` an.
6. Discord ruft den HTTPS-Callback der Web-App mit Discord-Code und Backend-OAuth-State auf.
7. Das Backend beansprucht den OAuth-Versuch atomar und einmalig, tauscht den Discord-Code mit `AUTH_DISCORD_ID` und `AUTH_DISCORD_SECRET` aus und lädt `/users/@me`.
8. Die Discord-ID wird ausschließlich über den vorhandenen Auth.js-Account `provider = discord` plus `providerAccountId = Discord User ID` einem kanonischen FRL-Benutzer zugeordnet. Namen sind niemals Identitätsschlüssel.
9. Der Login wird nur für einen aktiven, nicht gesperrten Benutzer mit mindestens einer Systemrolle und gegebenenfalls aktivem Fahrerprofil freigegeben. Es werden weder Rolle noch Liga aus mobilen Request-Daten übernommen.
10. Das Backend speichert einen kurzlebigen App-Code ausschließlich gehasht und leitet zu `frlracecontrol://auth/callback?code=...&state=CLIENTSTATE` zurück.
11. Die App prüft `clientState` und sendet App-Code plus ursprünglichen Code Verifier per POST an `/auth/exchange`.
12. Das Backend prüft den App-Code atomar und einmalig sowie PKCE zeitkonstant, erstellt eine getrennte Mobile-Sitzung und liefert Access- und Refresh-Token.

Der Backend-OAuth-State schützt den Discord-Callback. `clientState` bindet den nativen Rücksprung an den von der App begonnenen Vorgang. Beide Werte haben unterschiedliche Aufgaben und werden nicht gleichgesetzt.

## Endpunkte

Basis-Pfad: `/api/mobile/v1`

| Methode | Pfad | Authentifizierung | Zweck |
| --- | --- | --- | --- |
| GET | `/auth/discord/start` | Parameter | OAuth-Versuch anlegen und zu Discord weiterleiten |
| GET | `/auth/discord/callback` | Discord-State | Discord-Code serverseitig tauschen und App-Code ausstellen |
| POST | `/auth/exchange` | App-Code + PKCE | erste Mobile-Sitzung ausstellen |
| POST | `/auth/refresh` | Refresh-Token im JSON-Body | Token rotieren und neuen Access Token ausstellen |
| POST | `/auth/logout` | Bearer Access Token | aktuelle Mobile-Sitzung idempotent widerrufen |
| GET | `/me` | Bearer Access Token | minimiertes, aktuelles Benutzerprofil laden |

### Start

```text
GET /api/mobile/v1/auth/discord/start
  ?redirectUri=frlracecontrol%3A%2F%2Fauth%2Fcallback
  &codeChallenge=...
  &codeChallengeMethod=S256
  &clientState=...
```

Der OAuth-Versuch läuft nach zehn Minuten ab und kann nur einmal beansprucht werden. Backend-State und App-Code werden nie im Klartext gespeichert.

### Exchange

```json
{
  "code": "one-time-app-code",
  "codeVerifier": "original-pkce-code-verifier",
  "platform": "ios",
  "deviceName": "iPhone",
  "appVersion": "1.0.0"
}
```

`platform`, `deviceName` und `appVersion` sind optionale, validierte Metadaten. Sie beeinflussen keine Rollen oder Berechtigungen. Der App-Code läuft nach fünf Minuten ab und wird durch den erfolgreichen Exchange atomar verbraucht.

### Access Token

Der HS256-Access-Token läuft nach 15 Minuten ab und enthält nur:

- `iss`: `https://frl-race-control.vercel.app`
- `aud`: `frl-race-control-mobile-v1`
- `sub`: kanonische User-ID
- `sid`: Mobile-Session-ID
- `iat`, `exp`, `jti`

Rollen, Liga, Team und Benutzerstatus sind keine alleinige Token-Wahrheit. `requireMobileUser(request)` prüft Bearer-Syntax, Signatur, Issuer, Audience, Ablauf, Session-Ablauf, Widerruf und aktuellen Benutzerstatus und lädt die Berechtigungsdaten aus der Datenbank.

### Refresh und Rotation

```json
{
  "refreshToken": "opaque-refresh-token"
}
```

Refresh-Tokens laufen spätestens mit der 30-Tage-Mobile-Sitzung ab. Jeder erfolgreiche Refresh markiert den vorigen Token atomar als verwendet und gibt einen neuen kryptografisch zufälligen Token aus. Nur SHA-256-Hashes werden gespeichert. Wird ein bereits verwendeter oder widerrufener Token erneut präsentiert, wird die gesamte Token-Familie beziehungsweise Mobile-Sitzung widerrufen. Refresh-Tokens stehen niemals in URLs.

Exchange und Refresh antworten mit:

```json
{
  "data": {
    "accessToken": "...",
    "accessTokenExpiresAt": "2026-08-05T12:15:00.000Z",
    "refreshToken": "...",
    "refreshTokenExpiresAt": "2026-09-04T12:00:00.000Z",
    "sessionId": "..."
  },
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-08-05T12:00:00.000Z"
  }
}
```

Die App speichert den Refresh-Token ausschließlich im nativen sicheren Speicher (iOS Keychain beziehungsweise Android Keystore/SecureStore), nie in AsyncStorage oder Logs.

### Logout

`POST /auth/logout` verwendet den aktuellen Access Token, widerruft ausschließlich die zugehörige Mobile-Sitzung und alle noch aktiven Refresh-Tokens. Wiederholte Requests sind sicher und liefern weiterhin Erfolg, solange der signierte Access Token die Sitzung eindeutig bezeichnet. Discord-Verknüpfung, Auth.js-Account und Web-Sitzungen bleiben erhalten.

### Me

`GET /me` liefert die notwendige öffentliche User-ID, Discord-Anzeigename und Avatar, Fahrername/-nummer/Flagge, aktuelle Liga, aktuelles Team und Teamlogo, Rollen, öffentliche Berechtigungskennungen, Benutzerstatus und Mobile-Session-ID. Alle Werte stammen aus der Datenbank.

Ausgeschlossen sind insbesondere E-Mail, Discord- und Auth.js-Tokens, Bot-Token, Secrets, interne FIA-Daten, Steward-Kommentare und unnötige Datenbankbezeichner.

## Fehler und Schutzmaßnahmen

JSON-Fehler verwenden nur einen öffentlichen Code und eine sichere Meldung:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Zu viele Anmeldeversuche. Bitte versuche es später erneut."
  }
}
```

Relevante Codes sind `INVALID_AUTH_REQUEST`, `OAUTH_CALLBACK_INVALID`, `OAUTH_ATTEMPT_INVALID`, `AUTHORIZATION_CODE_INVALID`, `PKCE_VERIFICATION_FAILED`, `ACCESS_TOKEN_INVALID`, `BEARER_TOKEN_REQUIRED`, `MOBILE_SESSION_INVALID`, `MOBILE_SESSION_EXPIRED`, `MOBILE_SESSION_REVOKED`, `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_REUSED`, `ACCOUNT_NOT_ALLOWED`, `RATE_LIMITED`, `LOGIN_FAILED` und `INTERNAL_ERROR`.

OAuth-Fehler nach einem erfolgreich zugeordneten Backend-State werden ohne interne Details als `frlracecontrol://auth/callback?error=LOGIN_FAILED&state=CLIENTSTATE` zurückgegeben. Unbekannte Discord-Accounts erhalten keine automatische Registrierung und keine Rolle.

Strenge Rate Limits gelten pro gehashtem Client-Fingerprint: Start 20/10 Minuten, Callback 30/10 Minuten, Exchange 20/10 Minuten und Refresh 60/Stunde. Vollständige IP-Adressen werden nicht gespeichert. CORS gilt nur für konfigurierte Entwicklungs-Origins und wird nie als Authentifizierung verwendet.

Logs enthalten nur Phase, Ergebnis, sichere Fehlerklasse und gegebenenfalls anonymisierte IDs. Discord-Code, Discord-Tokens, App-Code, PKCE-Verifier, Access-/Refresh-Token und Secrets dürfen nicht protokolliert werden. Der mobile Callback ist auch vom Next.js-Request-Logging ausgeschlossen, weil der Discord-Code als Queryparameter eintrifft.

## Datenhaltung und Cleanup

Die additive Migration `20260805180000_mobile_auth_v1` erstellt `MobileOAuthAttempt`, `MobileAuthorizationCode`, `MobileSession` und `MobileRefreshToken` sowie das additive Benutzerfeld `lockedAt`. Sie wird nicht automatisch gegen Supabase ausgeführt.

Der vorhandene tägliche Notification-Cleanup entfernt zusätzlich abgelaufene OAuth-Versuche und Codes, verbrauchte Kurzzeitdatensätze nach einer kurzen Aufbewahrung sowie lange abgelaufene oder widerrufene Mobile-Sitzungen. Refresh-Token-Datensätze werden durch Session-Cascade entfernt; verbrauchte Hashes bleiben bis dahin zur Wiederverwendungserkennung erhalten.

## Expo-Integration

Der echte Discord-Login benötigt wegen des registrierten Custom Schemes einen Development Build beziehungsweise einen signierten Store-Build. Expo Go unterstützt den produktiven Login nicht zuverlässig und ist dafür ausdrücklich nicht vorgesehen.

Die spätere App-Integration soll:

1. `expo-crypto`/WebCrypto oder eine gleichwertige sichere Quelle für Verifier und State verwenden.
2. den Systembrowser über `expo-web-browser` öffnen und `frlracecontrol://auth/callback` über Expo Linking registrieren.
3. vor dem Exchange den zurückgegebenen `state` zeitkonstant beziehungsweise sicher mit dem lokal gehaltenen `clientState` vergleichen.
4. Access Token nur im Speicher halten und Refresh Token im nativen SecureStore ablegen.
5. bei `401` genau einen koordinierten Refresh durchführen und bei `REFRESH_TOKEN_REUSED` vollständig abmelden.
6. niemals Discord-Secrets, Bot-Token, Datenbank- oder Supabase-Service-Zugang in App-Konfiguration oder `EXPO_PUBLIC_*` aufnehmen.
