# FRL Graphics Studio

## Nutzung

Unter **Admin → Ergebnisse** ist das Graphics Studio direkt sichtbar.
Qualifying bietet Classification, Pole und Front Row. Rennen bietet Race
Classification, Starting Grid, Winner, Fastest Lap, Podium sowie Fahrer- und
Teamwertung. Typ wählen → Grafik erzeugen → PNG herunterladen.

Die Vorschau liest ausschließlich die veröffentlichten Ergebnisse der gewählten
Liga, des Rennens und der passenden Session. Ein gespeicherter Entwurf wird
nicht als offizielles Resultat exportiert. Rendern/Download versendet keine
Discord-Nachricht und verändert keine Ergebnisdaten.

- Pole/Front Row stammen aus den finalen Qualifying-Plätzen.
- Winner/Podium stammen aus den finalen Rennplätzen, nicht aus der Eingabereihenfolge.
- Fastest Lap verwendet die kleinste vorhandene positive Rundenzeit; DSQ/DNS
  sind ausgeschlossen. Bei Zeitgleichheit werden alle zeitgleichen Fahrer gezeigt.
- Grid verwendet die gespeicherten Startpositionen des veröffentlichten Rennens.
  Fehlende oder doppelte Positionen führen zu einer verständlichen Meldung.
  Es wird keine unbestätigte Startaufstellung aus Qualifying-Plätzen erfunden.
- Full-Qualifying-Gaps vergleichen nur dieselbe Q-Phase und werden entsprechend
  beschriftet. Fehlende Zeiten bleiben „—“.
- Die WM-Grafiken zeigen den aktuellen Saisonstand, keinen historischen Snapshot.

## Fahrerbilder

Unter **Admin → Fahrer → Fahrer bearbeiten → Bild und Karrierestatistik**
gibt es zusätzlich zum Profilbild **Result Graphic Image / Driver Render**.
Nur Benutzer mit der bestehenden Stammdatenberechtigung dürfen dieses Bild
hochladen, ersetzen oder entfernen.

Priorität: dediziertes Grafikbild → Profilbild → neutraler Platzhalter mit
Initialen und Teamfarbe. Auch ein nicht erreichbares Grafikbild fällt auf das
Profilbild zurück. Neue Render-Vorgänge lesen die aktuellen Bildreferenzen;
bereits exportierte PNGs bleiben unverändert.

PNG, WebP und JPEG bis 3 MB. Die bestehende Dateisignatur-/MIME-Prüfung bleibt
aktiv. Sharp entfernt Metadaten, begrenzt Eingabepixel und erhält für Renderbilder
Transparenz und Seitenverhältnis (maximal 1400 × 1800, kein quadratischer Crop).
Freigestellte PNGs/WebPs im Rennanzug sind ideal. Keine automatische
Freistellung und keine künstlich erzeugten Fahrer.

Storage: bestehender öffentlicher Bucket aus `SUPABASE_DRIVER_IMAGE_BUCKET`
oder `SUPABASE_STORAGE_BUCKET`; neue Dateien liegen unter
`drivers/{driverId}/result/{uuid}.webp`. Schreiben erfolgt ausschließlich
serverseitig. Alte Dateien werden nach erfolgreicher DB-Aktualisierung
bereinigt; fehlgeschlagene DB-Updates räumen die neu angelegten Dateien auf.

## Migration / Rollout

Neue additive Migration:
`20261005120000_driver_result_graphic_image`

Sie ergänzt ausschließlich die nullable Textspalte
`Driver.resultGraphicImageUrl`. Keine Änderung an Profilbild, Fahreridentität,
Zuordnungen, Ergebnissen oder Historie. Die Migration muss vor Nutzung des neuen
Prisma-Clients in der Zielumgebung angewendet sein. Sie wurde von Codex nicht
gegen eine bestehende Datenbank ausgeführt. Frühere offene/fehlgeschlagene
Migrationen sind separat zu klären; hier wird kein Recovery automatisiert.

Keine neue Storage-Variable notwendig. Für die bisherigen automatischen
Grafik-Uploads bleibt `SUPABASE_RESULT_GRAPHICS_BUCKET` (Default:
`result-graphics`) erforderlich.

## Architektur

- `lib/graphics/templates/catalog.ts`: Typen, Labels, Session-Zuordnung, Layoutwahl.
- `templates/types.ts`: reines Render-Datenmodell.
- `templates/primitives.ts`: gemeinsame Schwarz/Magenta/Cyan-Tokens,
  XML-Escaping, begrenzte Textbreiten, sichere eingebettete Bilder.
- `templates/layouts.ts`: Classification, Solo, Duo, Podium und Grid.
- `result-graphic-data.ts`: testbare Auswahl, Sortierung und Zeit-/Gap-Aufbereitung.
- `result-graphic-service.ts`: echte App-Daten, Asset-Hydration, bestehende Job-Pipeline.
- `result-graphic-storage.ts`: kontrollierte Supabase-Quellen, keine Redirects,
  Byte-/Pixel-/Zeitlimits; maximal vier Assets werden gleichzeitig geladen.
- `result-graphic-renderer.ts`: SVG-Komposition und verlustfreier Sharp-PNG-Export.

Standardformat 1920 × 1080; größere Tabellen/Grids wachsen vertikal, statt
Teilnehmer abzuschneiden. Harte Höhen-/8-MB-Grenzen schützen den Renderer.
Textgrößen passen sich ihrer Spaltenbreite an; untrusted Text wird escaped.
Raster-Assets werden vor dem Einbetten normalisiert. Keine externe Browser-
oder Screenshot-Engine im Production-Renderer.

Identische Daten liefern in derselben Sharp-/Font-Laufzeit identische PNGs.
Für pixelidentische Exporte zwischen Betriebssystemen muss auch die Font-
Installation identisch sein (DejaVu Sans, Fallback Arial/sans-serif).

## Bestehende Automatisierung

Automatische Qualifying-/Race-/WM-Jobs laufen weiterhin nach Veröffentlichung
über die vorhandene Outbox; zusätzliche Highlight-Typen werden im Studio bei
Bedarf erzeugt, um nicht automatisch mehrere neue Discord-Posts zu senden.
Die exakte Liga-Zuordnung und vorhandenen Retry-Regeln bleiben erhalten.
Veraltete Ergebnisrevisionen werden nicht als aktuelle Job-Grafik gerendert.
Neurendern erhöht die Renderrevision und schreibt eine neue cache-sichere Datei.
Vorhandene Fremdänderungen an TCWM-Benennung und serieller Job-Verarbeitung
wurden erhalten.

## Lokale Prüfung

`npm test` enthält PNG-Decoding und deterministische Ausgabe für alle zehn
Typen, große Teilnehmerfelder, XML-/URL-Sicherheit, finale Platzierungen,
Qualifying-Gaps, Session-/Publication-Gates, fehlende Zeiten/Startpositionen
sowie transparente Renderbild-Verarbeitung.

`node --conditions=react-server --import tsx scripts/preview-result-graphics.ts`
erzeugt lokale PNGs und eine Kontaktübersicht in einem neuen temporären
Verzeichnis. Die klar beschrifteten synthetischen Fixtures sind ausschließlich
Testdaten; Production-Routen importieren sie nicht.

Graphics Studio und Renderbild-Uploader wurden mit den echten Komponenten
in einer isolierten lokalen UI-Prüfung bei 360/390/430/768/1024/1440/1920 px
geprüft: keine horizontale Überbreite, Bedienelemente mindestens 48 px hoch.
Die Podiumsvorschau wurde im Browser als vollständiges 1920 × 1080-PNG geladen.
Der automatisierte Download-Abschluss im In-App-Browser meldete einen Timeout;
das Speichern über einen normalen Browser sowie ein echter Supabase-Upload
sind deshalb noch als Deployment-Smoke-Test auszuführen.

## Dateien dieses Umbaus

Neu:

- `lib/graphics/templates/catalog.ts`
- `lib/graphics/templates/types.ts`
- `lib/graphics/templates/primitives.ts`
- `lib/graphics/templates/layouts.ts`
- `lib/graphics/result-graphic-data.ts`
- `lib/graphics/testing/fixtures.ts`
- `scripts/preview-result-graphics.ts`
- `prisma/migrations/20261005120000_driver_result_graphic_image/migration.sql`

Geändert:

- `lib/graphics/result-graphic-renderer.ts`
- `lib/graphics/result-graphic-renderer.test.ts`
- `lib/graphics/result-graphic-service.ts`
- `lib/graphics/result-graphic-storage.ts`
- `components/championship/ResultGraphicPreview.tsx`
- `components/championship/ResultsEditor.tsx`
- `app/api/admin/results/graphics/preview/route.ts`
- `components/drivers/DriverImageUploader.tsx`
- `app/(protected)/admin/drivers/[id]/page.tsx`
- `app/api/drivers/[id]/image/route.ts`
- `lib/storage/driver-image-storage.ts`
- `lib/master-data/types.ts`
- `lib/master-data/queries.ts`
- `prisma/schema.prisma`
- `docs/result-graphics.md`

Andere bereits vorhandene Working-Tree-Änderungen gehören nicht zu diesem Umbau.
