# Wochenkorb V8.2 – Bin sowieso dort

- **Neuer Einkauf-Flow** auf der bisherigen Einkaufsseite: Markt antippen → passende Angebote prüfen → freiwillig zur Liste ergänzen. Keine zusätzliche Hauptnavigation und kein neuer Pflichtschritt beim Einkaufen.
- **Lidl-Filialangebote:** gezielte Filialsuche per Ort/PLZ über öffentliches Lidl-Plus-Angebotssystem; echte Aktionsdaten mit Gültigkeitsdatum, soweit verfügbar.
- **dm-Sortimentspreise:** integrierte Suche nach bekannten Artikeln; ausdrücklich kein erfundener Angebotsvergleich.
- **ALDI Süd:** vorhandene Suchfunktion erhalten, gemeinsame Händleransicht ergänzt.
- **Empfehlungen nur bei Bedarf:** Listentreffer zuerst; außerplanmäßige Vorschläge nur für Stammartikel oder wiederholt gekaufte Produkte mit belegtem Rabatt (mindestens 10 % / 0,20 €).
- **Andere Märkte, gleiche Artikel:** „Hier mitnehmen“ verschiebt die Marktzuordnung nur für diese Einkaufswoche, nicht den Katalogartikel. Keine automatische Aufnahme von Angeboten.
- **Doppelte Artikel vermeiden:** Listenaufnahme nutzt vorhandene Katalogeinträge und Zutatenfamilien; Produktformen wie frische und Dosentomaten bleiben getrennt.
- **Keine DB-Migration:** Familienzustand/Rezeptdaten und Sync-Mechanik bleiben erhalten; pro Gerät merken wir nur die gewählte Filiale und den heutigen Markt.
- **Einschränkungen:** Händler-Schnittstellen außerhalb von ALDI sind inoffiziell/unverifiziert; dm-Sonderangebote und Lidl-Plus-Coupons weiterhin offen. Ohne aktualisierte Supabase-Funktion werden nur alte ALDI-Abfragen funktionieren.
- **Tests:** 7 lokale Browser- und Cloud-Testskripte plus 6 Node-Testfälle. Drittanbieterantworten im Test simuliert.
