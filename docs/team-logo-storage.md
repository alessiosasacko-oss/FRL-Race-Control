# Teamlogo-Speicher einrichten

Teamlogos werden serverseitig geprüft, mit Sharp nach WebP konvertiert und im
öffentlichen Supabase-Storage-Bucket `team-logos` gespeichert. Browser erhalten
niemals den Service-Role-Key und können den Bucket nicht direkt beschreiben.

## Bucket

1. In Supabase Storage einen **öffentlichen** Bucket `team-logos` anlegen.
2. Die maximale Dateigröße des Buckets auf `2 MB` begrenzen.
3. Als erlaubte MIME-Typen `image/webp` konfigurieren. Die Anwendung nimmt PNG,
   JPEG und WebP an, speichert nach der serverseitigen Verarbeitung aber nur WebP.
4. Keine INSERT-, UPDATE- oder DELETE-Policy für anonyme oder authentifizierte
   Browser-Clients anlegen. Änderungen laufen ausschließlich über die geschützte
   Admin-Route und den serverseitigen Service-Role-Client.

Die Anwendung legt Dateien unter
`<teamOrganizationId>/<uuid>.webp` und die zugehörige Vorschau unter
`<teamOrganizationId>/<uuid>-thumb.webp` ab. Dadurch kann sie beim Ersetzen oder
Entfernen ausschließlich selbst verwaltete Dateien der betroffenen Organisation
löschen.

## Umgebungsvariablen

```dotenv
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="server-only-service-role-key"
SUPABASE_TEAM_LOGO_BUCKET="team-logos"
```

`SUPABASE_SERVICE_ROLE_KEY` darf weder mit `NEXT_PUBLIC_` beginnen noch in Logs,
Client-Bundles oder Commits erscheinen. Der Bucketname ist optional; ohne Wert
verwendet die Anwendung `team-logos`.

## Betrieb

- Nur Admins und Super Admins mit Stammdaten-Berechtigung dürfen hochladen,
  ersetzen oder entfernen.
- Beim Ersetzen bleibt das bisherige Logo aktiv, bis Bildverarbeitung, Upload und
  Datenbanktransaktion erfolgreich waren. Erst danach werden alte Storage-Dateien
  bestmöglich entfernt.
- Datenbankfehler nach einem Upload lösen eine Bereinigung der neu hochgeladenen
  Dateien aus.
- In Listen wird die 256-Pixel-Vorschau verwendet; große Darstellungen verwenden
  das maximal 1024 Pixel große Original.
- Fehlerprotokolle enthalten ausschließlich Benutzer-/Organisations-IDs und
  Fehlercodes, keine Storage-Schlüssel oder Dateiinhalte.
