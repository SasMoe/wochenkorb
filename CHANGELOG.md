# Wochenkorb V7 – 08.11.2026

- Deutscher Chefkoch-RSS-Rezeptfeed für Entdecken, inklusive Import-Dialog aus Feedkarten.
- ALDI Süd öffentliche Produktsuche (experimentell; keine Verfügbarkeitszusage).
- dm Aktionen und Lidl Prospekt als direkte Händlerlinks; dm als Bon- und Angebotsgeschäft.
- Automatisch erfasste reduzierte ALDI-Artikel nur für bekannte Produkte, mit Ablauf nach 48 Stunden.
- Supabase-Funktionen recipe-feed, store-feed, recipe-import bereits im Nutzerprojekt bereitgestellt.
- Bestätigungsmail leitet bei erneuter Registrierung ausdrücklich zur aktuellen App-URL zurück.
- Bestehende Listen, Designs und Cloud-Datenstruktur bleiben erhalten.

# Wochenkorb V6 – 8. November 2026

## Neu
- Kassenbon-Erfassung mit Fotoauswahl und optionaler lokaler OCR sowie Text-Import.
- Kontrollansicht: Positionen, Mengen und Preise vor Übernahme bearbeiten oder entfernen.
- Einkaufsverlauf: Datum, Geschäft, Produkte, Menge, Preis; Löschen einzelner Bons.
- Vorratsradar: vorsichtige Hinweise aus wiederholten Kaufintervallen, keine erfundenen exakten Vorräte.
- Angebotsfilter: Nur bekannte Artikel, ALDI Süd oder Lidl-Wasser, hinreichender Preisabstand, Ablaufdatum.
- Geschützte lokale Backups enthalten die zusätzlichen Daten.
- Neuer Bereich „Lernen“ in der mobilen und Desktop-Navigation.

## Bewusst nicht vorgetäuscht
- Noch **keine** automatischen Händler-Angebotsdaten. Angebote werden bis zur legalen technischen Anbindung manuell eingelesen.
- Keine verlässliche automatische Ermittlung von Produktbeständen aus einem einzelnen Bon.
- Kein vollautomatischer Chefkoch-Feed und kein allgemeiner Webseiten-Scraper.
- Supabase-Konfiguration und reale Mehrgeräte-Synchronisation erfolgen im nächsten Schritt. Bestehender V5-Cloud-Code ist erhalten.

## Installation
1. In Wochenkorb V5 unter **Verwalten → Datensicherung** ein Backup herunterladen.
2. Dateien aus diesem Archiv in die Wurzel des GitHub-Repositorys übernehmen, insbesondere `index.html`, `intelligence.js`, `intelligence.css`, `sw.js`. Zusätzliche V5-Dateien ebenfalls behalten.
3. GitHub Pages mit `main`/`root` publiziert die neue Version. Nach einem Update ggf. Seite einmal neu laden, damit der Service Worker den V6-Cache übernimmt.
4. **Lernen** öffnen. Zunächst ohne Cloud-Anmeldung über **Vorerst lokal ausprobieren** nutzen.
5. Kassenbons oder Angebote nur nach Kontrolle importieren. Die bestehende Einkaufsliste bleibt unabhängig davon erhalten.

## Tests
`python tests/test_ui.py && python tests/test_intelligence.py && python tests/test_cloud_mock.py && node --check intelligence.js && node --check cloud.js`
