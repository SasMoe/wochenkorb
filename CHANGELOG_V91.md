# Wochenkorb V9.1 – Mengen direkt beim Einkaufen und ganze Backrezepte

- Einkaufsmenge prominent auf der Einkaufsansicht, auch aus alten Listeneinträgen ohne `amounts`.
- Im Einkaufslisten-Teilen-Dialog werden Artikel mit Mengen ausgegeben.
- Portionen werden nur für normale Mahlzeiten individuell skaliert; Backrezepte zählen als ganze Rezeptdurchläufe.
- Bei Kuchen, Torten, Keksen und ausgewählten Backwaren automatische Erkennung – Pfannkuchen bleiben Portionsgerichte.
- Anzahl der ganzen Backrezepte per Plus/Minus einstellbar; Rezeptausbeute (z. B. 12 Stück) als Information sichtbar.
- Umschaltung der Planungsart im Rezept, falls die automatische Zuordnung nicht passt.
- Geänderte Rezeptzutaten und Planungsarten führen zu einem Hinweis auf die aktualisierungsbedürftige Einkaufsliste.
- Keine Schemaänderung, keine automatischen DB-Mutationen, Erhalt der Einkaufs-Häkchen beim Aktualisieren.

Prüfung: 12 Unit-Tests (`v9-core.js`) und V9/V9.1-Browser-Regressionen erfolgreich; ältere V8.2-UI- und V8.1-Produktform-Tests erfolgreich. Kein Live-Test mit eurem Supabase-Konto / euren beiden Geräten durchgeführt.
