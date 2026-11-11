# Wochenkorb V9.1 – Installation

## Was ändert sich?

- **Einkaufen**: Mengen stehen sichtbar an jedem Artikel, direkt unter dem Namen (nicht erst unter `ⓘ`). Auch frühere Einkaufslisten ohne strukturierte Mengenfelder werden lesend gegen den aktuellen Bedarf abgeglichen.
- **Teilen**: Die geteilte Einkaufsliste enthält ebenfalls die Einkaufsmenge.
- **Kuchen und Backrezepte**: Die Planung verwendet 1 ganzen Kuchen / 1 ganzen Backdurchgang statt 2,5 Familienportionen. Über `−` / `+` lassen sich 1, 2, ... ganze Rezepte planen.
- **Alltagsgerichte**: Behalten die individuellen Familienportionen.
- **Rezepte**: Für Grenzfälle kann die Planungsart per Schaltfläche `1 ganzes Rezept` / `Familienportionen` umgeschaltet werden. Die Einstellung wird im gemeinsamen Haushaltszustand gespeichert.
- Bereits vorhandene Mahlzeiten und Rezeptdaten bleiben bestehen. Keinerlei Migration/Änderung an Supabase erforderlich.

## GitHub Pages: Update

1. In **Wochenkorb** auf beiden Geräten warten, bis **„Synchronisiert“** erscheint. Zur Sicherheit vorher die Datensicherung aus der App exportieren.
2. Die vier Dateien aus der ZIP **im Hauptverzeichnis** deines GitHub-Repositories `SasMoe/wochenkorb` ersetzen: `v9.js`, `v9-core.js`, `v9.css`, `sw.js`.
3. `config.js`, `CNAME`, `index.html` und **alle** Supabase-Daten unverändert lassen.
4. GitHub Pages neu laden (auf iPhones ggf. die installierte App einmal vollständig schließen und erneut öffnen). Der Service-Worker-Cache wurde auf `wochenkorb-v91-shell-1` erhöht.
5. Unter **Einkaufen** auf **„Liste aktualisieren“** tippen. **Nicht** auf „Neue Einkaufsliste“: Das würde vorhandene Einkaufs-Häkchen zurücksetzen.

## Kurztest

- Bolognese auf 3 Portionen stellen → 375 g Hackfleisch bei 500 g/4 Portionen im Original.
- Käsekuchen mit 12 Stücken einmal einplanen → **1 Kuchen / 12 Stücke**, komplette Zutatenmenge, keine Familienportionen.
- Bei 2 Kuchen → doppelte Zutatenmenge.
- **Einkaufen** → Menge unter jedem Artikelnamen. Kein Tippen auf `ⓘ` nötig.
- Artikel abhaken und App auf dem zweiten Telefon synchronisieren lassen.

## Grenzen

- Ein Rezept ohne verlässliche Mengenangaben zeigt **„Menge noch offen“**, statt eine Menge zu erfinden.
- Alte Rezepte mit vermischten Einheiten (z. B. `Stk` statt `g`) müssen wie zuvor ggf. berichtigt werden. V9.1 schätzt keine Dichten oder Packungsgrößen.
- Die Erkennung von Backrezepten arbeitet zunächst anhand des Rezeptnamens (Käsekuchen, Marmorkuchen, Kekse etc.). Bei Ausnahmen die Planungsart im Rezept ändern.
- Neue Einkaufslisten werden erst beim Aktualisieren persistiert; die Ansicht kann schon vorher den aktuell berechneten Bedarf zeigen, während sie weiterhin einen Hinweis zum Aktualisieren anzeigt.
