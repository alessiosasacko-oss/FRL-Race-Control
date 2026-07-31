<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verbindliche Mobile- und Desktop-Regeln

Die bestehende Desktop-Version von FRL Race Control darf bei Mobile-Anpassungen nicht verändert werden.

Jede neue Funktion, jede Seitenänderung und jede neue UI-Komponente muss ab sofort gleichzeitig für folgende Größen umgesetzt und geprüft werden:

- Smartphone ab 360 px
- Smartphone 390 px
- Smartphone 430 px
- Tablet
- Desktop

Eine Änderung gilt erst als abgeschlossen, wenn die mobile Darstellung und Bedienung ebenfalls vollständig umgesetzt und getestet wurden.

Desktop darf dabei nicht unbeabsichtigt verändert oder verschlechtert werden.

- Mobile-Anpassungen bevorzugt über responsive Tailwind-Klassen umsetzen.
- Gemeinsame Komponenten dürfen keine Desktop-Regression erzeugen.
- Desktop-spezifische Layouts beginnen am bestehenden Breakpoint `lg`.
- Mobile- und Tablet-Layouts gelten unterhalb von `lg`.
- Keine ungeprüften globalen CSS-Änderungen vornehmen.
- Jede UI-Aufgabe benötigt eine Mobile-Prüfung.
- Jede Abschlussmeldung muss die Mobile-Validierung erwähnen.
- Keine breite Desktop-Tabelle unverändert auf Smartphones anzeigen.
- Touchflächen müssen mindestens 44 × 44 px groß sein.
- Die Seite darf keine horizontale Überbreite erzeugen.
- Keine Funktion darf mobil fehlen; bei getrennten Renderstrukturen muss dieselbe Fachlogik verwendet werden.
