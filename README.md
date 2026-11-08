**Update V7:** Siehe [V7_INSTALL.md](V7_INSTALL.md). ALDI Süd Produktsuche (experimentell), dm/Lidl-Händlerübersicht, Chefkoch-Rezeptfeed, vollständige Link-Import-Unterstützung über bereits deployte Supabase-Funktionen.

# Wochenkorb V7 – eure Familien-Einkaufs-App

Eine schlanke, auf Smartphones optimierte Progressive Web App ohne Build-Tool.
GitHub Pages liefert nur die Oberfläche; Supabase verwaltet Konten und gemeinsame Daten.
Das Projekt ist privat nutzbar, aber der statische Quellcode bei einem öffentlichen GitHub-Pages-Repository für alle lesbar. **Keine geheimen Schlüssel in dieses Repository eintragen.**

## Aktueller Funktionsumfang

- **Stammzutaten, Nach Bedarf, Rezepte** als drei Einkaufsquellen. Gleiche Artikel ergeben genau einen Eintrag.
- **Haushaltsbereiche** (Kühlschrank, Speisekammer, Kinderbedarf …) bei der Vorratsprüfung und **Einkaufskategorien** beim Einkauf.
- **Neue Woche:** alle Artikel beginnen auf offen. Zuhause vorhandene Artikel markieren; im Laden die restlichen kaufen.
- Mengen optional und ausschließlich in den Details/Notizen.
- Bearbeitbare Lebensmittel, Kategorien, Portionen, Rezeptliste und Wochenplan.
- Echte Rezeptvorschläge über Chefkoch-Feed; Import über HTML/JSON-LD/Zutatenliste, unterstützte Rezept-Links per Edge Function.
- **Zwei getrennte Supabase-Auth-Konten**, ein gemeinsamer Familienhaushalt, einmaliger Einladungscode.
- Echtzeit-Aktualisierung der Häkchen zwischen Geräten. Dokumente für Rezepte/Kategorien mit Revisionsschutz (gleichzeitige Konflikte werden nicht blind überschrieben).
- **Drei Designs:** Midnight, Rose Light, Rose Dark; pro Benutzer gespeichert.
- Datenexport/-import als JSON sowie installierbare PWA, lokale Zwischenspeicherung und Offline-Warteschlange für bereits geladene Daten.

## Einrichtung: Supabase

1. Auf [supabase.com](https://supabase.com) ein neues Projekt erstellen.
2. Im **SQL Editor** `supabase/migrations/202611070001_family.sql` **einmal** vollständig ausführen.
3. Unter **Authentication → Providers → Email** die E-Mail/Passwort-Anmeldung aktivieren; nach Bedarf E-Mail-Bestätigung aktiv lassen.
4. Unter **Authentication → URL Configuration** die spätere App-URL als **Site URL** und **Redirect URL** eintragen. Für das vorhandene Repository beispielsweise `https://sasmoe.github.io/wochenkorb/`. Bei eigener Domain später entsprechend ergänzen.
5. `config.js` mit der **Project URL** und dem **Publishable Key** aus **Project Settings → API Keys** ausfüllen. Ausschließlich `sb_publishable_...` oder den Legacy-`anon`-Key eintragen, **niemals `service_role`/`secret`**.
6. Optional, aber für den Import fremder Rezeptlinks erforderlich: **Supabase CLI** installieren, am Projekt anmelden und im Repository-Verzeichnis ausführen:

   ```bash
   supabase login
   supabase link --project-ref DEINE_PROJEKT_REF
   supabase functions deploy recipe-import
   ```

   Der Code dazu liegt unter `supabase/functions/recipe-import/index.ts`. Es werden ausschließlich bekannte Rezeptdomains abgefragt, um unerwünschte Zugriffe auf interne Adressen zu vermeiden. Manche Webseiten blockieren Serverabrufe; dann den HTML-/Textimport verwenden.

7. Alle Dateien aus dem Projektverzeichnis (mit Ausnahme von `tests/`, `preview-*.png` und `supabase/`, die nicht fürs Hosting notwendig sind) in die Wurzel des GitHub-Repositories `SasMoe/wochenkorb` hochladen. GitHub Pages ist bereits auf `main / (root)` eingestellt.
8. Website öffnen, **Konto erstellen**; ggf. Bestätigungs-E-Mail bestätigen. Erster Benutzer: **Familie erstellen**. In **Verwalten → Familie & Design** einmaligen Einladungscode kopieren. Zweiter Benutzer registriert eigenes Konto und wählt **Familie beitreten**.
9. In **Verwalten** persönliches Theme auswählen. Über Safari **Teilen → Zum Home-Bildschirm** installieren.

**Hinweis:** Der Schlüssel und die URL sind derzeit absichtlich leer. Die App startet deshalb zunächst mit dem lokalen Demo-Modus. Echte Mehrgeräte-Synchronisierung erfordert ein eingerichtetes Supabase-Projekt.

## Hosting mit eigener Domain

Für `einkauf.example.de` einen DNS-`CNAME` auf `sasmoe.github.io` setzen und unter **GitHub → Settings → Pages → Custom domain** `einkauf.example.de` eintragen. HTTPS nach erfolgreicher Ausstellung aktivieren. Anschließend die neue Domain auch in Supabase unter Auth URL Configuration ergänzen.

## Datenschutz und Datenmodell

`households` und `household_members` definieren den Familienbereich. `household_state` speichert die Einkaufsquellen, Kategorien, Rezepte, Wochenplan und den aktuellen Einkauf als versioniertes JSON-Dokument. `item_statuses` speichert Häkchen **pro Woche und Artikel getrennt**: Gleichzeitiges Abhaken wird damit unabhängig von Änderungen an Rezepten/Listen synchronisiert. `user_preferences` hält das individuelle Theme. `household_invites` speichert nur einen Hash des Einladungscodes (einmalig, sieben Tage gültig).

Alle Tabellen haben PostgreSQL **Row Level Security**. Daten anderer Haushalte sind nicht lesbar. Die `save_household_state`-RPC verwendet einen erwarteten Revisionswert und verweigert konkurrierende Schreibvorgänge. Im Konfliktfall bleibt die lokale Kopie erhalten und kann exportiert werden; eine automatische Zusammenführung unterschiedlicher Rezeptänderungen ist nicht implementiert.

**Offline:** Wenn die PWA zuvor online geladen wurde, stehen ihre zuletzt gespeicherten Daten im lokalen Browser und können im Offline-Modus geöffnet werden. Häkchen und andere Änderungen werden zwischengespeichert und nach erneuter Verbindung übertragen. Der Online-Rezept-Feed benötigt Internet. Bei gleichzeitig vorgenommenen Änderungen desselben Artikels gewinnt der zuletzt synchronisierte Zustand. Vollständig erprobt ist die Offline-Synchronisierung erst nach Test mit zwei realen Geräten.

## Tests

```bash
python tests/test_ui.py
python tests/test_cloud_mock.py
node --check cloud.js
```

Die beiden Tests verwenden Chromium und Python Playwright. `test_ui.py` prüft lokale Einkaufsabläufe und Themes; `test_cloud_mock.py` simuliert Auth, Familienladen, Dokument-Speicherung und Status-Synchronisierung. **Eine echte Supabase-End-to-End-Prüfung ist ohne Projektadresse und Zugang nicht möglich.**

## Projektstruktur

- `index.html` – UI und bestehende Offline-fähige Einkaufslogik
- `theme.css` – Midnight / Rose Light / Rose Dark
- `cloud.js` – Anmeldung, Familie, Realtime, Offline-Queue und Rezeptimport-Anbindung
- `config.js` – öffentliche Supabase-Projektparameter (Platzhalter)
- `sw.js`, `manifest.webmanifest`, `icon-*.png` – PWA
- `supabase/migrations/` – PostgreSQL-Schema, RLS und RPCs
- `supabase/functions/recipe-import/` – kontrollierter Rezeptlink-Import
- `tests/` – Smoke-Tests

## Altbestand / Migration

Bei Verwendung desselben Browsers und derselben Domain bleiben die bisherigen Wochenkorb-V4-Daten unter dem LocalStorage-Key `wochenkorb-v4` erhalten. Beim Erstellen des **ersten Familienhaushalts** wird dieser lokale Datenbestand als Startinhalt übernommen. Vor Umstellung zur Sicherheit eine JSON-Sicherung über **Verwalten → Sicherung herunterladen** speichern.

## Bekannte Grenzen

- Der TheMealDB-Feed ist überwiegend englisch. Deutsche Rezeptlinks lassen sich je nach Website über die Edge Function importieren; nicht jede Webseite bietet maschinenlesbare Rezeptdaten.
- Die Einkaufsliste/Rezepte gehören allen Mitgliedern des Haushalts; Gastrollen mit eingeschränkten Rechten gibt es derzeit nicht.
- Bei gleichzeitigem Bearbeiten der **Stammdaten** greift ein Revisionskonflikt; keine automatische Zusammenführung. Statusänderungen sind hiervon unabhängig.
- Supabase braucht Auth-Konfiguration, Datenbankmigration und optional eine manuell deployte Edge Function. Keine Server-Zugangsdaten im Frontend.
- Die PWA benötigt einen HTTPS-Host für Service Worker und Home-Screen-Installation; `file://` reicht nicht.


## Neu in V6 (vor Supabase verwendbar)

Die neue Registerkarte **Lernen** ergänzt V5 ohne bestehende Einkaufs- oder Rezeptdaten zu löschen.

- **Kassenbon**: Foto aufnehmen, lokale OCR per optional nachgeladener Tesseract.js-Bibliothek versuchen, oder den Bon-Text direkt einfügen. Erkannte Positionen sind vor Speicherung vollständig bearbeitbar. Der Parser versteht einfache Zeilen im Format `MILCH 1,19`; komplexe Kassenzettel, Rabatte, Stück-/Gewichtsangaben und OCR-Fehler müssen manuell geprüft werden.
- **Einkaufshistorie**: Preis, Produktname, Menge, Geschäft und Datum speichern; Bon-Fotos werden nicht gespeichert. Die Historie ist über JSON-Sicherung exportierbar.
- **Vorratsradar**: Erst ab mindestens drei verschiedenen Einkaufszeitpunkten für ein Produkt wird ein grobes Nachkaufintervall geschätzt. Frischeprodukte und unzureichende Daten führen bewusst zu „prüfen“ oder „unbekannt“. Der Algorithmus kennt weder exakte Restmengen noch das Verbrauchsdatum, und entfernt deshalb keine Artikel aus der vollständigen Wochenliste.
- **Angebotsfilter**: ALDI Süd standardmäßig, Lidl nur Wasser; ausschließlich Produkte, die bereits in Katalog, Einkauf, geplantem Rezept oder Kaufhistorie bekannt sind. Bei einem Vergleichspreis müssen mindestens 10 % und 0,20 € Unterschied vorliegen. Importformat: `Artikel;Angebotspreis;Referenzpreis;ALDI Süd;YYYY-MM-DD`. **Es gibt in V6 bewusst keinen automatischen Händler-Datenabruf und keinen Werbe-Feed.**
- **Datenspeicherung**: V6 verwendet den bestehenden Zustand `wochenkorb-v4`, erweitert um `receipts`, `offers` und `storePreferences`; das vorhandene JSON-Backup nimmt diese Felder mit. Bei späterem Supabase-Setup werden sie Bestandteil des Familienzustands, der anhand des bestehenden V5-Cloud-Moduls synchronisiert wird. Die echte Cloud-Synchronisation muss gesondert getestet werden.

OCR benötigt für die Erstladung Internet und lädt Tesseract.js v5.1.1 von jsDelivr. Die Erkennung läuft nach dem Laden im Browser, ohne dass Wochenkorb das Bonbild an unseren Server sendet. Fremde Ressourcenanbieter können beim Abruf technische Verbindungsdaten sehen. OCR ist optional; Textimport funktioniert ohne diese Bibliothek.

Tests: `python tests/test_ui.py`, `python tests/test_intelligence.py`, `node --check intelligence.js`. Bitte V5-Daten vor dem Austausch exportieren.
