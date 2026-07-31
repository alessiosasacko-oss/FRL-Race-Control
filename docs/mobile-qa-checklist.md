# FRL Race Control – Mobile-QA-Checkliste

Diese Checkliste ist für jede UI-Änderung verbindlich. Desktop wird ab `lg` als Referenz behandelt; Mobile-Varianten dürfen keine Fachlogik oder Berechtigung duplizieren.

## Viewports und allgemeine Qualität

- [ ] 360 × 800 px
- [ ] 390 × 844 px
- [ ] 430 × 932 px
- [ ] 768 × 1024 px (Tablet)
- [ ] 1024 × 768 px (Desktop-Breakpoint)
- [ ] 1440 × 900 px (Desktop-Referenz)
- [ ] Desktop-Layout und Informationshierarchie sind unverändert
- [ ] Keine horizontale Seitenüberbreite
- [ ] Touchflächen sind mindestens 44 × 44 px groß
- [ ] iOS- und Android-Safe-Areas werden berücksichtigt
- [ ] Bildschirmtastatur verdeckt keine Eingabe oder Hauptaktion
- [ ] Dark Mode funktioniert
- [ ] Light Mode funktioniert
- [ ] Lange Namen, Titel, URLs, Mentions und Dateinamen brechen sicher um
- [ ] Fokus, Tastaturbedienung und sichtbare Pressed-/Active-Zustände funktionieren
- [ ] `prefers-reduced-motion` wird respektiert

## Seiten

- [ ] Login
- [ ] Dashboard
- [ ] Kalender
- [ ] Rennwochenende
- [ ] Rennanmeldung
- [ ] Ergebnisübersicht
- [ ] Result Editor
- [ ] Fahrer-WM
- [ ] Team-WM
- [ ] Teamchef-WM
- [ ] FIA-Liste
- [ ] FIA-Ticketdetail
- [ ] FIA-Archiv
- [ ] Fahrerübersicht und Fahrerprofil
- [ ] Teamübersicht und Teamdetail
- [ ] Benachrichtigungen
- [ ] Admin Design & Branding
- [ ] Admin Strecken
- [ ] Admin Liga-Zeitpläne
- [ ] Weitere Adminlisten und Formulare

## Workflows

- [ ] Discord Login und Rückleitung
- [ ] Eigene Rennanmeldung
- [ ] Teamchef-Anmeldung mit Begründung
- [ ] FIA-Ticket erstellen
- [ ] Video beziehungsweise Evidence hochladen, entfernen und erneut versuchen
- [ ] Chatnachricht schreiben
- [ ] @Mention einfügen
- [ ] Steward-Abstimmung abgeben
- [ ] Ticket abschließen und archiviertes Ticket lesen
- [ ] Ergebnisentwurf speichern
- [ ] Ergebnis validieren
- [ ] Ergebnis veröffentlichen und mobilen Bestätigungsdialog bedienen
- [ ] Designentwurf speichern und Design veröffentlichen
- [ ] Track-Layout oder Hero-Bild hochladen

## Seitenspezifische Prüfpunkte

- [ ] Mobile Navigation zeigt nur berechtigte Ziele und bleibt erreichbar
- [ ] Bottom Navigation verdeckt keine Sticky Action Bar
- [ ] Desktop-Sidebar bleibt ab `lg` unverändert vorhanden
- [ ] Breite Tabellen besitzen mobil Karten, Listen oder Accordion-Zeilen
- [ ] Result Editor zeigt mobil und auf Tablets Fahrerkarten und ab `lg` weiterhin die bestehende Tabelle
- [ ] FIA-Ticket enthält mobil Status, Informationen, Chat, Evidence, Abstimmung, Entscheidung und Historie
- [ ] FIA-Dreispaltenlayout bleibt auf Desktop bestehen
- [ ] Track Layout ist vollständig sichtbar und behält sein Seitenverhältnis
- [ ] Video- und Bildmedien überschreiten nicht die Bildschirmbreite
- [ ] Mobile Uploads bieten erreichbare Datei-, Kamera- und Galerieauswahl, soweit vom Gerät unterstützt
- [ ] Adminformulare stapeln Felder sinnvoll und behalten eine erreichbare Speicheraktion
- [ ] Keine wichtige Touchaktion hängt ausschließlich von Hover oder Drag-and-drop ab
