# Wochenkorb V8 – Update für einkauf.kaul.family

**Vor dem Upload:** Öffne Wochenkorb und lade unter **Verwalten → Sicherung herunterladen** eine JSON-Sicherung. Prüfe, dass ihr beide keine noch nicht synchronisierten Änderungen habt. Warte auf „✓ Synchronisiert“.

1. Diese ZIP entpacken.
2. Dateien und Ordner in die Wurzel von `SasMoe/wochenkorb` hochladen und vorhandene gleichnamige Dateien ersetzen.
3. **`config.js` und `CNAME` unverändert lassen.** Sie sind absichtlich nicht im Paket. Die Supabase-Verbindung und `einkauf.kaul.family` bleiben erhalten.
4. Die bereits bereitgestellten Edge Functions `recipe-feed`, `recipe-import`, `store-feed` bleiben bestehen. Für V8 ist **keine SQL-Migration** erforderlich.
5. GitHub Pages auf `https://einkauf.kaul.family/` aufrufen, bei Bedarf Website neu laden bzw. im Safari die PWA neu starten. Der Service Worker verwendet jetzt die Cache-Version `wochenkorb-v8-shell-1`.
6. **Verwalten**: Suche (auch innerhalb von 300+ Artikeln), `⇄ Stamm` / `⇄ Bedarf`, Mehrfachauswahl und Synonyme prüfen.
7. **Zuhause**: „Nach Bedarf durchsuchen“ und in die Wochenliste aufnehmen. **Einkaufen**: nach Laden suchen und Filialzuständigkeit ändern.
8. **Lernen**: Kassenbons wie bisher, Händlerlinks sowie die **optionale** ALDI-Suche für bis zu sechs Artikel. Preise sind keine Zusage zu Filialbestand oder Kassenpreis.
9. **Rezepte → Entdecken**: deutscher Chefkoch-Feed; „Zutaten importieren“ öffnet den bisherigen Rezept-Link-Importer.

## Was nicht automatisch passiert

- Keine automatische Änderung eurer bereits gestarteten Wocheneinkaufsliste. Beim Wechsel von Stamm/Bedarf erscheint ein Hinweis, die Einkaufsliste zu aktualisieren. Gekaufte/vorhandene Häkchen bleiben bei normalen Aktualisierungen erhalten.
- Keine automatische Zusammenführung vorhandener Katalogduplikate. Vorschläge lassen sich unter „Gleiche Zutaten prüfen“ kontrolliert zusammenführen.
- Kein automatischer Produktabgleich aus Bonbildern mit unbekannten Artikeln, keine verlässlichen Live-Angebote für dm und Lidl, keine automatisierten Coupons.
- Die ALDI-Produktschnittstelle ist inoffiziell und kann ausfallen; bei Netz- oder Formatfehlern erscheint eine verständliche Rückmeldung.
- Bei gleichzeitigen **Katalogänderungen** von zwei Geräten gilt weiterhin die bisherige Supabase-Revisionssperre. Warte auf „Synchronisiert“, bevor ihr beide denselben Katalog bearbeitet. Bei einem Konflikt geht nichts automatisch verloren; die App zeigt eine Warnung und hält die lokale Sicherung bereit.

## Sicherheit / Daten

V8 erweitert den vorhandenen versionierten Familien-JSON-Zustand um optionale Felder `ingredientAliases` und `catalog[].store`. Das vorhandene `version: 4`-Dokumentformat bleibt aus Kompatibilitätsgründen erhalten. Alle übrigen Tabellen, RLS-Regeln, persönlichen Themes und Login-Konfigurationen bleiben unangetastet.

## Tests

```bash
python tests/test_ui.py
python tests/test_intelligence.py
python tests/test_v7.py
python tests/test_cloud_mock.py
python tests/test_v8.py
node --check v8.js
```

Die Tests laufen mit lokalem Chromium bzw. Supabase-Mocks; die vollständige Zwei-Geräte-Prüfung und die aktuellen Händlerantworten sind nicht Teil dieser Tests.
