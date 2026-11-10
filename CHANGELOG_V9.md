# V9 – Rezeptbasierte Familienplanung

- Gericht-zuerst-Startseite und wiederholbare Wochenplan-Mahlzeiten mit frei wählbaren Wochentagen.
- Personenbezogene Portionsanteile und gemeinsame Berechnung aller benötigten Zutaten.
- Als Mahlzeit planbares Abendvesper mit eigenen Zutaten je Familienmitglied.
- Stammrezept-Markierung mit Favoriten-Sortierung in der Rezeptsammlung.
- Strukturierte Mengen direkt an den Artikelzeilen: Bedarf, Vorrat, Fehlmenge; Gramm/Kilogramm und Liter/Milliliter kompatibel; andere Maßeinheiten getrennt.
- Bedarfs- und Rezeptmengen über mehrere Mahlzeiten summieren; ohne Gramm-pro-Stück-Annahmen.
- Vorsichtige, explizit bestätigte Inventarisierung; keine künstliche Bestandsbuchung beim Abhaken.
- Feste, quellendokumentierte Rezeptnährwerte pro Originalportion, skalierte Anzeige im Plan, automatische Invalidierung nach Rezeptänderungen.
- Kein neues Backend, keine Supabase-Migration, keine Änderungen an RLS oder Familienmitgliedern.
- 8 neue Node-Regressionstests und ein Chromium-DOM-End-to-End-Test.

Nicht als fertig deklarieren: einmalige Berechnung und Qualitätsprüfung der Nährwerte für sämtliche bestehenden Rezepte mit BLS / Produktetiketten. Die Werte fehlen aktuell noch größtenteils, bis eine belastbare Referenz verfügbar ist.
