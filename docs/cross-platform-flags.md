# Plattformübergreifende Länderflaggen

FRL Race Control rendert Länderflaggen als lokale SVG-Dateien aus `flag-icons` 7.5.0. Die Assets liegen unter `public/flags`, werden mit dem Production Build ausgeliefert und benötigen weder ein CDN noch eine externe Laufzeit-URL. Die App verwendet ausschließlich normalisierte ISO-3166-1-Alpha-2-Codes aus der zentralen Allowlist.

Das behebt die Windows-Eigenheit, bei der Unicode-Regionalindikatoren abhängig von Schriftart und Browser als Buchstaben wie `IT` oder `DE` erscheinen. Die SVG-Darstellung ist für Windows 10 und Windows 11 sowie Edge und Chrome geeignet. Geprüft werden Desktop und die mobile 390-px-Darstellung. Kann ein Asset nicht geladen werden, zeigt die zentrale Komponente ein neutrales Globus-Icon und niemals einen Rohcode oder ein kaputtes Bild.

Die SVGs stammen aus dem MIT-lizenzierten Projekt `flag-icons`; die Lizenz liegt zusammen mit den Assets unter `public/flags/LICENSE.txt`.
