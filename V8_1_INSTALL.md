# Wochenkorb V8.1 – Rezept-Zutaten nach Produktform sortieren

## Update

1. In Wochenkorb **Verwalten → Sicherung herunterladen** und auf beiden Geräten Synchronisierung abwarten.
2. Das ZIP entpacken und die enthaltenen Dateien in dein Repository übernehmen; `config.js` und `CNAME` bleiben **unverändert**.
3. Warten, bis GitHub Pages die Änderungen ausliefert. Seite auf beiden iPhones bei Bedarf neu laden.
4. Die vorhandene Einkaufsliste nur dann aktualisieren, wenn du die neu berechneten Kategorien sehen möchtest. Bestehende Häkchen bei Bedarf vorher sichern.

## Fehlerbehebung

- `kl. Dose/n Tomaten, stückige (ca. 400 g)` → **Stückige Tomaten (Dose)**, **400 g**, **Speisekammer / Konserven**.
- Zwei Dosen à 400 g → 800 g (wenn im Zutatenfeld ausdrücklich angegeben).
- Passierte Tomaten und Tomatenmark bleiben Konserven; frische Tomaten und Rispentomaten bleiben Obst & Gemüse; tiefgekühltes Gemüse bleibt Tiefkühl.
- Auch bisher gespeicherte Rezepte mit der problematischen Dosentomaten-Schreibweise werden beim Erstellen einer Einkaufsliste korrekt kategorisiert, ohne das Originalrezept zu überschreiben.
- Die Struktur der Supabase-Datenbank, die synchronisierten Katalogartikel, Rezepte und der Login werden nicht direkt geändert.

## Grenzen

- Bei beliebigen ungewohnten, unstrukturierten Zutatenbezeichnungen kann die automatische Erkennung weiterhin unsicher sein. Die Kategorien bleiben manuell editierbar.
- Bereits vorhandene Einträge in einer *erstellten* Einkaufsliste werden durch ein Code-Update allein nicht rückwirkend umsortiert, bis die Liste aktualisiert wird.

## Tests

Die sechs lokal vorhandenen Browser-Testgruppen liefen erfolgreich durch, darunter ein zusätzlicher Regressionstest `tests/test_v81.py` für Dosentomaten, Tiefkühlprodukte, frische Tomaten und ältere Rezeptimporte.
