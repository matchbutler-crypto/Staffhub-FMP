# Multi-Select im „Ressource einsetzen" Modal

**Datum:** 2026-05-14  
**Status:** Genehmigt

## Ziel

Im „Ressource einsetzen" Modal sollen mehrere Ressourcen gleichzeitig durch Anklicken ausgewählt und in einem Schritt auf eine Vakanz eingereicht werden können.

## Scope

Nur `src/components/ressource-einsetzen-dialog.tsx`. Keine API-Änderungen erforderlich.

## State-Änderung

`selectedRessource: PoolRessource | null` wird ersetzt durch `selectedIds: Set<string>`.

Die Auswahl wird als Set von Ressource-IDs geführt — unabhängig vom aktiven Suchfilter. Beim Submit werden die vollen Ressource-Objekte aus dem ungefilterten `ressourcen`-Array nachgeschlagen, sodass eine Suchänderung zwischendurch die Auswahl nicht verliert.

## Klick-Verhalten

Klick auf eine Zeile togglet die ID im Set:
- ID nicht im Set → hinzufügen (Zeile markiert, `IconCheck` sichtbar)
- ID im Set → entfernen (Zeile demarkiert)
- Bereits eingereichte Ressourcen (`bereits_gespielt = true`) sind disabled und nicht auswählbar.

## Submit-Logik (`handleSpielen`)

Alle ausgewählten Ressourcen werden parallel eingereicht:

```
const selected = ressourcen.filter(r => selectedIds.has(r.id))
const results = await Promise.allSettled(
  selected.map(r => POST /api/ressourcen/${r.id}/spielen { vakanz_id })
)
```

Fehlerbehandlung:
- Jede fehlgeschlagene Einreichung → `toast.error("${name} konnte nicht eingereicht werden")`
- Abschluß-Toast: `toast.success("X von Y Ressourcen eingereicht")` (X = Erfolge)
- KI-match im Hintergrund für jede erfolgreiche Einreichung
- Modal schließt danach, `onSuccess()` wird aufgerufen

## Button-Text

| Auswahl | Button-Text | Zustand |
|---------|------------|---------|
| 0 | „Ressource auswählen" | disabled |
| 1 | „1 Ressource einsetzen" | aktiv |
| n ≥ 2 | „n Ressourcen einsetzen" | aktiv |

## Reset beim Schließen

Beim Schließen des Modals (`open = false`) wird `selectedIds` auf ein leeres Set zurückgesetzt (wie bisher `selectedRessource = null`).

## Nicht im Scope

- Tab „Neu anlegen" bleibt unverändert
- Keine API-Änderungen
- Kein Limit für die Anzahl gleichzeitig auswählbarer Ressourcen
