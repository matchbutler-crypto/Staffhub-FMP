# Preismodell & Margen-Tracking für Beauftragungen — Design Spec

## Ziel

Agenturen können Preise auf zwei Weisen angeben: (1) reiner EK-Preis, Staffhub-Marge wird aufgeschlagen, oder (2) VK-Preis inkl. bereits enthaltener Staffhub-Marge. Das System bildet beide Fälle sauber ab, speichert den Originalpreis der Agentur für Audit-Zwecke und zeigt den finalen VK transparent an.

---

## Datenmodell

### Tabelle `beauftragungen` — neue Felder

| Feld | Typ | Default | Bedeutung |
|------|-----|---------|-----------|
| `agentur_rohpreis` | numeric | — | Was die Agentur gemeldet hat (Pflichtfeld) |
| `marge_inkludiert` | boolean | `false` | Ist die Marge im Rohpreis enthalten? |

### Bestehende Felder (bleiben, werden berechnet gespeichert)

| Feld | Typ | Default | Bedeutung |
|------|-----|---------|-----------|
| `einkaufspreis` | numeric | — | Was Staffhub an die Agentur zahlt |
| `margenaufschlag` | numeric | `75` | Staffhub-Marge in € (änderbar pro Beauftragung) |
| `verkaufspreis` | numeric | — | Was der Auftraggeber zahlt (VK) |

### Berechnungslogik

```
if marge_inkludiert = false:
  einkaufspreis = agentur_rohpreis
  verkaufspreis = agentur_rohpreis + margenaufschlag

if marge_inkludiert = true:
  verkaufspreis = agentur_rohpreis
  einkaufspreis = agentur_rohpreis - margenaufschlag
```

### Beispiele

| Rohpreis | Marge | Checkbox | EK | VK |
|----------|-------|----------|----|----|
| 500 € | 75 € | aus | 500 € | 575 € |
| 600 € | 75 € | an | 525 € | 600 € |
| 550 € | 50 € | aus | 550 € | 600 € |
| 600 € | 50 € | an | 550 € | 600 € |

**Constraint:** Berechnetes `einkaufspreis` muss > 0 sein (d.h. `agentur_rohpreis > margenaufschlag` wenn Checkbox an).

---

## API

### POST `/api/beauftragungen`

**Input-Änderungen:**
- Neu: `agentur_rohpreis` (number, required, > 0)
- Neu: `marge_inkludiert` (boolean, optional, default `false`)
- `margenaufschlag` (number, optional, default `75`, ≥ 0)
- `einkaufspreis` fällt als Input-Feld weg — wird serverseitig berechnet

**Validierung:**
- `agentur_rohpreis` > 0
- `margenaufschlag` ≥ 0
- Wenn `marge_inkludiert = true`: `agentur_rohpreis > margenaufschlag` (sonst EK ≤ 0)

**Verarbeitung:** Server berechnet `einkaufspreis` und `verkaufspreis` nach obiger Logik und speichert alle fünf Felder.

### GET `/api/beauftragungen`

Response ergänzt um `agentur_rohpreis` und `marge_inkludiert` in allen Beauftragungen — für UI-Vorbelegen bei Bearbeitung und Audit-Anzeige.

---

## UI

### Beauftragung-Formular (Anlegen & Bearbeiten)

```
Agentur-Preis (€)    [ 600        ]
Marge (€)            [ 75         ]   ← default 75, pro Beauftragung änderbar
                     [x] Marge bereits im Preis enthalten

────────────────────────────────────────
EK (an Agentur):        525 €
Staffhub-Marge:          75 €
VK (an Auftraggeber):   600 €          ← live aktualisiert
```

- Live-Vorschau (EK / Marge / VK) aktualisiert sich sofort beim Tippen
- Checkbox-Label: "Marge bereits im Preis enthalten"
- Fehleranzeige wenn `marge_inkludiert = true` und `rohpreis ≤ marge` (EK würde ≤ 0)

### Abrechnung-Tabelle

Spalten für Manager/Controller:

| Kandidat | Agentur | EK/Tag | Marge/Tag | VK/Tag | Stunden/Wo | Status |
|----------|---------|--------|-----------|--------|------------|--------|

- `VK/Tag` = `verkaufspreis` — neue Hauptspalte
- `Marge/Tag` = `margenaufschlag` — nur für Manager/Controller sichtbar, nicht für Agentur
- `EK/Tag` = `einkaufspreis` — nur für Manager/Controller sichtbar

---

## Berechtigungen

| Rolle | Kann Rohpreis sehen | Kann EK sehen | Kann Marge sehen | Kann VK sehen |
|-------|---------------------|---------------|------------------|---------------|
| Admin / Staffhub Manager | ✅ | ✅ | ✅ | ✅ |
| Controller | ✅ | ✅ | ✅ | ✅ |
| Agentur | nur eigene | ✅ (nur eigene) | ❌ | ✅ (nur eigene) |

---

## Migration

1. `ALTER TABLE beauftragungen ADD COLUMN agentur_rohpreis numeric` (NOT NULL mit Backfill auf `einkaufspreis`)
2. `ALTER TABLE beauftragungen ADD COLUMN marge_inkludiert boolean NOT NULL DEFAULT false`
3. Bestehende Beauftragungen: `agentur_rohpreis = einkaufspreis`, `marge_inkludiert = false` (konsistent mit "EK + Marge on top")
