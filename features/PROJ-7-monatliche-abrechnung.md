# PROJ-7: Monatliche Abrechnung + CSV/PDF-Export

**Status:** In Progress  
**Erstellt:** 2026-04-13  
**Priorität:** P0 (MVP)

---

## Beschreibung

Monatliche Abrechnungsübersicht für alle aktiven Beauftragungen. Der Staffhub Manager wählt einen Monat, sieht aggregierte Umsatz/Kosten/Marge-Zahlen pro Agentur und kann die Daten als CSV oder PDF exportieren.

---

## User Stories

1. Als Staffhub Manager möchte ich einen Abrechnungsmonat wählen, um die finanzielle Übersicht für diesen Monat zu sehen.
2. Als Staffhub Manager möchte ich Umsatz, Kosten und Marge pro Agentur aggregiert sehen, damit ich schnell abrechnen kann.
3. Als Staffhub Manager möchte ich die Abrechnung als CSV exportieren, für Buchhaltungsprogramme.
4. Als Staffhub Manager möchte ich die Abrechnung als PDF drucken/exportieren, für Archivzwecke.

---

## Acceptance Criteria

- [ ] AC-1: Monatspicker (Monat + Jahr) mit Default = aktueller Monat
- [ ] AC-2: Tabelle zeigt alle aktiven Beauftragungen mit Monatszahlen
- [ ] AC-3: Gruppierung nach Agentur mit Zwischen-Summen
- [ ] AC-4: Gesamt-Footer-Zeile (Summe Umsatz / Kosten / Marge)
- [ ] AC-5: CSV-Export (alle Zeilen, kompatibel mit Excel)
- [ ] AC-6: PDF-Export via Browser-Druckdialog (Print-optimiertes Layout)
- [ ] AC-7: Nur Staffhub Manager und Admin haben Zugriff

---

## Tech Design

### Seite: `/abrechnung`

- Client Component
- Monatspicker: `<select>` für Monat + Jahr (letzten 12 Monate + nächster Monat)
- Daten: `GET /api/beauftragungen` (reuse PROJ-6 API, keine neue Route nötig)
- Berechnung client-seitig: `stunden_woche × 4` Monatsstunden × Preis
- Gruppierung nach `agentur_id` / `agentur_name`

### CSV Export
- Client-seitig mit `Blob` + `URL.createObjectURL`
- Format: BOM für Excel-Kompatibilität (ä, ö, ü korrekt)
- Spalten: Agentur, Kandidat, Vakanz, h/Woche, EK/Tag, VK/Tag, Marge%, Umsatz/Mo, Kosten/Mo, Marge/Mo

### PDF Export
- `window.print()` mit `@media print` CSS-Klassen
- Druckoptimiert: keine Sidebar, keine Navigation, Logo + Titel + Datum als Header
- Tailwind print:-Klassen: `print:hidden`, `print:block`

### Dependencies
- Keine neuen Pakete (reuse bestehende shadcn/ui + Tailwind)

---

## Edge Cases

- Keine aktiven Beauftragungen → Leere Tabelle mit Hinweistext
- Monat in der Vergangenheit → gleiche Berechnung (MVP: keine historischen Stundenaufzeichnungen)
- Agentur hat mehrere Beauftragungen → korrekte Summenbildung

---

## Dependencies

- Requires: PROJ-6 (Beauftragungen + Margenberechnung) - API bereits vorhanden
