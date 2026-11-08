# Wochenkorb V7.1 – deutscher Feed

## Update
1. In Wochenkorb ein JSON-Backup erstellen.
2. Die Dateien aus dem ZIP in die Wurzel des GitHub-Repositories hochladen (bestehende Dateien ersetzen).
3. **config.js** und **CNAME** nicht verändern – sie sind absichtlich nicht Bestandteil des Update-ZIPs.
4. Auf der Domain `https://einkauf.kaul.family/` die Seite neu laden, bei Bedarf die PWA einmal schließen und neu öffnen.

## Korrekturen
- Alter englischer TheMealDB-Feed wird nicht mehr automatisch geladen.
- Chefkoch-Vorschläge werden nach erfolgreichem Supabase-Login aufgerufen.
- Bei einer gestörten Feed-Abfrage wird eine Fehlermeldung gezeigt, niemals ersatzweise ein englischer Feed.
- Unter **Verwalten**: Apple-Erinnerungen als kopierte Textliste importieren. Neue Artikel werden dedupliziert und als Bedarfsartikel angelegt.
- Der Import wird über die bestehende `mutate`-/Cloud-Synchronisierung gespeichert. Die eigentliche iCloud-Freigabe-URL kann nicht serverseitig ohne autorisierten Zugriff ausgelesen werden.

## Einschränkungen
- Der iCloud-Freigabelink konnte nicht ausgelesen werden. Die einmalige Datenübernahme ist deshalb noch offen und wird nicht vorgetäuscht.
- Der Chefkoch-RSS-Endpunkt muss im echten Betrieb erreichbar sein; andernfalls zeigt die App eine transparente Fehlermeldung.
- Die Verknüpfung von RSS-Treffern mit dem Rezeptimport muss mit echten Chefkoch-Links geprüft werden.
