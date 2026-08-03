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
