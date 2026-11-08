# Wochenkorb V7 – Installation

**Zuerst in der laufenden App unter Verwalten → Sicherung herunterladen ein JSON-Backup anlegen.**

1. Die Dateien aus dieser ZIP in das Stammverzeichnis deines GitHub-Repositories `SasMoe/wochenkorb` kopieren; `CNAME` und die bereits konfigurierte `config.js` **nicht überschreiben**. Die ZIP enthält bewusst keine neue CNAME-Datei und keine aktiven Supabase-Schlüssel.
2. Auf GitHub Pages nach dem Deploy neu laden (gegebenenfalls Browser-Cache aktualisieren). Die PWA-Shell-Version ist erhöht.
3. Die Supabase Edge Functions `recipe-feed`, `store-feed` und `recipe-import` sind in deinem Supabase-Projekt bereits bereitgestellt (am 08.11.2026). Du musst sie nicht erneut deployen. Die Functions benötigen ein gültiges Benutzer-JWT.
4. Bei Wochenkorb anmelden. Unter **Rezepte → Entdecken** liefert `recipe-feed` den Chefkoch-RSS-Feed, **Zutaten importieren** verwendet `recipe-import` und zeigt danach das Rezept in den eigenen Rezepten.
5. Unter **Lernen** findet sich die Händlerübersicht für ALDI Süd, dm und Lidl. ALDI hat eine experimentelle Live-Produktsuche, dm und Lidl offizielle Aktionsseiten. Manuelle Angebote unterstützen jetzt auch dm. Bon-Fotos unterstützen dm als Einkaufsort.

## Grenzen

- ALDI nutzt eine undokumentierte, öffentlich erreichbare Schnittstelle; Zugriff und Preise können sich ändern. Die Preissuche ist keine Garantie für eine aktuelle Filialverfügbarkeit.
- Die Suche importiert Angebote nur bei eindeutig ausgewiesenem Vorherpreis, und der bisherige Filter zeigt nur relevante Produkte. Keine fingierten Rabatte. Automatisch abgefragte ALDI-Angebote werden nach 48 Stunden als veraltet behandelt.
- Für dm und Lidl gibt es noch keinen stabilen Live-Datenimport, aber offizielle Händlerlinks und weiterhin manuelle Angebotsübernahme.
- Der Chefkoch-RSS-Feed enthält Links und Kurzbeschreibungen. Der eigentliche Rezeptimport benötigt auf der Zielseite strukturierte Schema.org-Recipe-Daten. Sites können Abrufe blockieren; die manuelle Zutatenliste bleibt der Fallback.
- Die drei vorhandenen Shop- und Rezeptflüsse bleiben getrennt vom Supabase-Datenmodell; kein neuer Tabellensatz erforderlich. Keine geheimen Schlüssel im Frontend.
