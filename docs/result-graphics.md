# FRL-Ergebnisgrafiken

Die Anwendung rendert Qualifying-, Renn-, Fahrer-WM- und Team-WM-Grafiken
deterministisch mit Sharp als 1920×1080-PNG. Es wird kein Browser gestartet.
Der Renderer verwendet ausschließlich FRL-Daten, das lokale FRL-Logo,
kontrollierte Teamlogos aus dem `team-logos`-Bucket und die gespeicherte
Fahrercharakter-Konfiguration. Fehlende Assets erhalten einen neutralen
FRL-Fallback.

Für den öffentlichen Supabase-Bucket `result-graphics` wird benötigt:

```dotenv
SUPABASE_RESULT_GRAPHICS_BUCKET="result-graphics"
```

Nur der serverseitige Service-Role-Client darf Dateien schreiben. Veröffentlichte
Jobs werden innerhalb der kurzen Ergebnistransaktion als `PENDING` angelegt und
anschließend über Next.js `after()` verarbeitet. Ein Renderfehler setzt den Job
auf `FAILED`, nimmt die erfolgreiche Ergebnisveröffentlichung aber nicht zurück.
Die externe Datenbankmigration wird im Deployment separat ausgeführt.

## Discord-Auslieferung

Fertige Grafiken werden über die bestehende Discord-Outbox versendet. Jede
Grafik verlangt eine exakte Liga-Zuordnung; globale oder fremde Liga-Fallbacks
sind bewusst ausgeschlossen. Qualifying verwendet `QUALIFYING_RESULTS`, Rennen,
Fahrerwertung und Teamwertung ihre jeweils eigenen Zielarten.

Ergebnisversion und Render-Revision bilden den Idempotenzschlüssel. Die Outbox
versucht Grafikzustellungen höchstens dreimal mit exponentiellem Backoff.
Fehlende Channel-Zuordnungen bleiben als `SKIPPED` für Admins sichtbar. Ein
manuelles Neurendern erzeugt mit `-r{renderingVersion}` eine cache-sichere Datei;
erneutes Senden verwendet denselben Queue-Datensatz.
