# Design: FTE-basierte Auto-Besetzt-Logik für Vakanzen

**Datum:** 2026-05-19  
**Status:** Approved

---

## Ziel

Wenn die Anzahl der Beauftragt-Ressourcen für eine Vakanz die `fte_anzahl` der Vakanz erreicht, soll die Vakanz automatisch auf "Besetzt" gesetzt und für Agenturen unsichtbar werden. Wird eine Beauftragung rückgängig gemacht, fällt die Vakanz in den Entwurfsmodus (Status "Offen", `published = false`).

---

## Betroffene Dateien

- `src/app/api/ressource-links/[id]/status/route.ts` — einzige Änderungsstelle

---

## Trigger-Logik

Die Logik wird nach dem bestehenden Status-Update in der PATCH-Route ausgeführt.

### Pfad 1 — Beauftragt erreicht

**Bedingung:** `newStatus === 'Beauftragt'`

1. Zähle alle `ressource_vakanz_links` mit `status = 'Beauftragt'` für `link.vakanz_id`
2. Lade `fte_anzahl` der Vakanz
3. Wenn `fte_anzahl` nicht null ist und `count >= fte_anzahl`:
   - `vakanzen.status = 'Besetzt'`
   - `vakanzen.published = false`
   - `vakanzen.besetzt_seit = new Date().toISOString()`
   - Historien-Eintrag: `"Vakanz automatisch auf 'Besetzt' gesetzt — FTE-Ziel erreicht (X/Y)"`

### Pfad 2 — Beauftragt rückgängig (Admin)

**Bedingung:** alter Status (`link.status`) war `'Beauftragt'` und `newStatus !== 'Beauftragt'`

1. Lade aktuellen Vakanz-Status
2. Wenn Vakanz-Status `'Besetzt'`:
   - Zähle verbleibende `ressource_vakanz_links` mit `status = 'Beauftragt'` für `link.vakanz_id`
   - Wenn `count < fte_anzahl` (oder `fte_anzahl` null):
     - `vakanzen.status = 'Offen'`
     - `vakanzen.published = false`
     - Historien-Eintrag: `"Vakanz auf 'Offen' (Entwurf) gesetzt — Beauftragung rückgängig gemacht (X/Y FTE)"`

---

## FTE-Dezimalwerte

Vergleich erfolgt direkt mit `>=` auf den Rohwert von `fte_anzahl` (numeric). Kein Floor/Ceiling. Beispiel: `fte_anzahl = 1.5`, 1 Beauftragt → noch nicht besetzt; 2 Beauftragt → besetzt.

---

## Agentur-Sichtbarkeit

Folgt automatisch aus `published = false`. Die bestehende GET-Logik in `/api/vakanzen` filtert bereits auf `published = true` für Agenturen — keine zusätzliche Änderung nötig.

---

## Randfälle

| Fall | Verhalten |
|------|-----------|
| `fte_anzahl` ist `null` | Logik wird komplett übersprungen |
| Vakanz ist bereits "Besetzt" und ein weiterer wird Beauftragt | Kein erneutes Update (idempotent) |
| Admin setzt von Beauftragt zurück, Vakanz ist nicht "Besetzt" | Kein Update der Vakanz |

---

## Nicht in Scope

- Benachrichtigungen (Slack, E-Mail) bei Statuswechsel
- Manuelles Wiederpublizieren der Vakanz nach Entwurfsfall (bestehende Publish-Funktion im Manager-UI)
- Änderungen am Beauftragungen-POST-Endpunkt (läuft bereits über PATCH-Route via Frontend)
