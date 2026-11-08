# Wochenkorb V8.2 – Intelligenter Einkaufsbegleiter

## Was ihr jetzt im Alltag macht

In **Einkaufen → Bin sowieso dort** geht es in drei kurzen Schritten:

1. **Lidl**, **ALDI Süd** oder **dm** antippen. Die Einkaufsliste wird dabei auf das Geschäft gefiltert.
2. **Passende Angebote prüfen** antippen. Für Lidl beim ersten Mal einmal die **Filiale über Ort/PLZ** auswählen. Das dient ausschließlich der Zuordnung der Angebotsdaten und bleibt auf diesem Gerät gespeichert.
3. **+ Liste** für einen sinnvollen Zusatzartikel oder **Hier mitnehmen** für ein bereits eingeplantes Produkt, das ihr diesmal in einem anderen Laden kaufen wollt. Ohne diese Aktion wird nichts an eurer Liste geändert.

Unter **Ein bestimmtes Produkt suchen** können einzelne Sortimentspreise nachgeschlagen werden. **Produktpreise sind keine Rabatte.** Ein Rabatt wird nur mit passendem belastbaren Vergleichspreis angezeigt; ein Zusatzartikel wird nur bei *mindestens 10 % und 0,20 €* Unterschied und tatsächlicher Haushaltsrelevanz vorgeschlagen. Keine automatische Prospektflut.

Die Marktauswahl für heute und die gewählte Lidl-Filiale bleiben pro Gerät lokal; eure **Einkaufsliste** und einmalig zugeordnete Artikel werden wie gewohnt zwischen euren beiden Konten synchronisiert. „Hier mitnehmen“ gilt nur für die aktuelle Woche, nicht für die dauerhafte Standardfiliale eines Artikels. In der nächsten Einkaufswoche sind diese Umleitungen zurückgesetzt.

## Vor dem Hochladen

**Die bisher laufende `store-feed`-Edge-Function kann nur ALDI-Suchen.** Für die neuen Lidl-/dm-Funktionen ist eine **einmalige Aktualisierung der Edge Function** erforderlich. Im verbundenen Supabase-Projekt wurde sie nicht automatisch ersetzt. Ohne diesen Schritt läuft die bestehende ALDI-Suche weiter; neue Lidl-/dm-Abfragen zeigen eine Fehlermeldung und ihr könnt jederzeit die Originalangebote öffnen.

### Schritt A – Supabase: `store-feed` aktualisieren

Im bestehenden Projekt `uzzogljczvetfhfjolzc` unter **Edge Functions → store-feed** den Inhalt von `supabase/functions/store-feed/index.ts` übernehmen und die Funktion deployen. **JWT-Verifikation unbedingt aktiviert lassen (`verify_jwt = true`)**. Nichts an der SQL-Datenbank, bestehenden Schlüsseln oder der Rezeptfunktion verändern.

Falls die Oberfläche keine direkte Bearbeitung anbietet: Mit Supabase CLI in diesem Projektverzeichnis (mit vorhandener Authentifizierung) ausführen:

```bash
supabase functions deploy store-feed --project-ref uzzogljczvetfhfjolzc
```

Die Funktionsquelle liegt im vollständigen Archiv sowie im GitHub-Update-ZIP unter `supabase/functions/store-feed/index.ts`. Für die CLI muss die Datei im Pfad `supabase/functions/store-feed/index.ts` liegen. **In den Frontend-Dateien gehören keine Admin-Schlüssel und keine Zugangstokens.**

### Schritt B – GitHub Pages aktualisieren

1. **Verwalten → Datensicherung herunterladen**. Auf beiden Geräten Sync abwarten.
2. Das ZIP entpacken; Dateien in die Wurzel von `SasMoe/wochenkorb` hochladen/ersetzen. Die Frontend-Dateien `v82-core.js`, `v82.js`, `v82.css` sind neu; `index.html`, `sw.js`, `v7.js`, `v8.js`, `intelligence.js` sind aktualisiert.
3. Eure bestehenden Dateien **`config.js` und `CNAME` nicht verändern**. Im ZIP sind sie bewusst nicht enthalten.
4. GitHub Pages fertig bauen lassen, Seite auf beiden iPhones einmal neu laden. Supabase-Daten und Rezeptbestand bleiben erhalten; keine SQL-Migration notwendig.

## Händlerstand und Grenzen

- **Lidl:** öffentliche, inoffizielle Lidl-Plus-**Filialangebote** ohne Account/Login; Filiale wählen. Persönlich aktivierbare Lidl-Plus-Coupons sind **nicht** enthalten. Filialangebot und Laufzeit prüfen.
- **ALDI Süd:** bestehende öffentliche **Produktsuche**, auf Wunsch für wenige Artikel; Preise sind nicht garantiert identisch mit der gewählten Filiale.
- **dm:** öffentliche, inoffizielle **Sortimentssuche und Produktpreise**. Für dm sind ohne verlässliche Rabatt-/Vergleichspreise **noch keine automatischen Schnäppchenvorschläge** möglich. Kein künstlich erzeugter Rabatt.
- Auf dem App-Server werden keine Nutzer-Logins an Händler weitergegeben. Datenquellen können sich ändern oder Anfragen blockieren. Dann zeigen wir eine Fehlermeldung und den offiziellen Händlerlink.
- Preis- und Produktquellen wurden in der lokalen Entwicklung über **Mocks** getestet; die echten Drittanbieter-APIs konnten hier nicht Ende-zu-Ende aufgerufen werden. Die Funktion ist vorbereitet, ihr praktischer Live-Test folgt nach dem Deploy.

## Daten- und Sicherheitsschutz

`store-feed` prüft die JWT-Anmeldung am Supabase-Gateway, validiert Händler, Suchbegriffe und Filialschlüssel. Es werden nur öffentliche Produkt- oder Filialangebote abgefragt; keine Supabase-Haushaltsdaten an die Händler übermittelt. Abfragen sind auf ein paar Artikel begrenzt, Ergebnisse werden vorübergehend gecacht. Es gibt **keine** automatischen Produktkäufe, Kontoverknüpfung mit Lidl Plus oder heimliche Hintergrund-Abfragen.

## Tests

Die unveränderten V5–V8.1-Funktionstests und die neue V8.2-Testreihe liefen lokal durch. Neue Tests:

```bash
node --test tests/test_v82.mjs
python tests/test_v82_ui.py
```

Es sind Tests mit simulierten Händlerantworten; sie ersetzen nicht den Praxistest nach dem Backend-Deploy.
