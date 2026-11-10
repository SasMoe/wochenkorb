# Wochenkorb V9 – Installation und Bedienung

## Installation ohne Datenverlust

1. In Wochenkorb auf **Verwalten → Datensicherung → Sicherung herunterladen** klicken. Auf beiden Geräten auf **✓ Synchronisiert** warten.
2. `wochenkorb-v9-github-upload.zip` entpacken. Die fünf Dateien `index.html`, `v9-core.js`, `v9.js`, `v9.css`, `sw.js` im Hauptverzeichnis von `SasMoe/wochenkorb` ersetzen bzw. ergänzen.
3. `config.js`, `CNAME`, Supabase-Tabellen, `cloud.js` sowie alte Rezepte nicht ersetzen oder löschen. **Es ist keine neue Datenbankmigration nötig.** Die App verwendet weiterhin den bestehenden gemeinsamen Haushaltszustand, `version: 4`.
4. Nach Veröffentlichung die Seite `https://einkauf.kaul.family/` auf beiden iPhones komplett neu laden. Bei installierter PWA nötigenfalls schließen und neu öffnen. Die Service-Worker-Cache-Version ist jetzt `wochenkorb-v9-shell-1`.
5. Zum Test ein Gericht auswählen, den Tag und die mitessenden Personen prüfen, die Einkaufsliste aktualisieren und anschließend den Vorrat für eine Zutat testweise ändern.

## Der neue tägliche Ablauf

**Zuhause → Was essen wir diese Woche?**

- Mit **+ Gericht auswählen** zu den gespeicherten Rezepten wechseln; mit **+ Woche** Gerichte in den Plan übernehmen. Dasselbe Gericht kann an mehreren Tagen erscheinen.
- Mit **+ Abendvesper** eine individuell zusammengestellte Familien-Brotzeit ergänzen. Unter **Verwalten → Familienportionen & Abendvesper** die Personen und Portionsfaktoren einmal festlegen. Mit **Vesper-Vorlieben bearbeiten** pro Person Zutaten pro Vesper angeben, eine pro Zeile, z. B. `2 Scheiben Brot` oder `30 g Käse`. Diese Angaben werden zusammengeführt, nicht als neue Produkte in den Katalog geschrieben.
- Den Wochentag auswählen. Unter **Wer isst mit?** kann je Person die Portionsgröße geändert werden (`0` = nicht dabei, `0,5` = halbe Portion). Für die Berechnung zählt die gesamte geplante Portionenzahl.
- **Neue Einkaufswoche** oder **Liste aktualisieren** drücken. Die Einkaufsliste zeigt **benötigt**, **vorhanden** und **einkaufen** direkt am Artikel.
- Mit **Bestand** eine tatsächlich vorhandene Menge eintragen. Bereits angelegte Artikel, Rezepttexte, Händlerzuordnungen, Checkmarks und Historie bleiben erhalten. Ein gekaufter Artikel verändert den Bestand nicht automatisch.

## Mengenregeln

- Rezeptmengen werden mit `geplante Portionen / Originalportionen` skaliert und dann aus allen Mahlzeiten addiert.
- `kg` wird nach `g`, `l` nach `ml` umgerechnet. Gramm und Stück, Scheibe und Gramm sowie EL und Gramm dürfen **nicht ohne Produktumrechnung** addiert werden. Keine verdeckten Umrechnungsannahmen.
- Stammartikel mit numerischer Menge und Bedarfsartikel mit eingegebener Menge zählen zusätzlich als Regelbedarf; leere oder unverständliche Mengen werden nicht erfunden.
- Eingetragener Vorrat wird nur in identischer oder kompatibel umgerechneter Maßeinheit abgezogen. Die Liste kann auch Artikel enthalten, deren Mengen noch unklar sind.
- Die bestehende Status-Synchronisierung bleibt separat: `offen`, `vorhanden`, `gekauft` werden weiterhin über `item_statuses` synchronisiert.

## Rezeptnährwerte (feste Datenbankwerte)

- **Rezepte → Meine Rezepte → Nährwerte**: kcal, Eiweiß, Kohlenhydrate, Fett und optional Ballaststoffe je **Original-Rezeptportion** eingeben. Quelle und Qualität werden dokumentiert und im Supabase-Haushaltszustand gespeichert.
- Bei der Wochenplanung wird der feste Wert mit den tatsächlichen Portionszahlen multipliziert. **Keine externe API bei jedem Öffnen**.
- Bei geänderten Rezeptzutaten oder Originalportionen wird der vorherige Nährwert automatisch als veraltet behandelt. Nicht hinterlegte Werte erscheinen als **Nährwerte noch offen**, nicht als erfundene Zahlen.
- Für die einmalige zuverlässige Befüllung aller 98 Rezepte ist eine separate Berechnung gegen einen Nährstoffdatensatz nötig (BLS 4.0, ggf. Produktetiketten). Diese Daten **sind nicht pauschal geschätzt oder als verifiziert markiert**.
- Quellenhinweis BLS: Max Rubner-Institut (2025), Bundeslebensmittelschlüssel Version 4.0, CC BY 4.0, DOI `10.25826/Data20251217-134202-0`.

## Sicherheits- und Migrationshinweise

Die V9-Funktionen erweitern das bestehende JSON-Dokument um `v9Meals`, `v9Profiles`, `v9Vesper`, `v9Pantry` und optionale `recipe.favorite`/`recipe.nutrition`-Felder. **Bestehende Plan-Einträge werden zunächst nur lesend angezeigt** und beim ersten Editieren in den neuen Mehrfach-Wochenplan übernommen. Es findet kein automatisches Schreiben oder Löschen in Supabase allein durch das Laden von V9 statt.

**Wichtig:** Beide Personen sollten V9 verwenden, bevor sie gleichzeitig den neuen Wochenplan bearbeiten. Die bisherige dokumentweite Revisionsprüfung kann bei konkurrierenden Änderungen einen Sync-Konflikt signalisieren; wie bisher dann zuerst lokal sichern und nicht blind überschreiben.
