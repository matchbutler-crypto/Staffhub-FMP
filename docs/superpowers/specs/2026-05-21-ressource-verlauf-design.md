# Ressource Verlauf (Audit Log) — Design Spec

**Datum:** 2026-05-21  
**Rollen:** Admin, Staffhub Manager, Agentur  
**Status:** Approved

---

## Kontext

Jede Aktion auf einer Ressource (Profil-Änderung, Vakanz-Workflow, Feedback, CV) soll in einem nicht-bearbeitbaren Verlauf-Tab nachvollzogen werden können. Manager und Agenturen können zusätzlich manuelle Notizen hinzufügen.

---

## Datenmodell

### Bestehende Tabelle: `ressource_historie`

```sql
id          uuid        PK
ressource_id uuid       FK → ressourcen
link_id     uuid        FK → ressource_vakanz_links (nullable)
typ         text        'system' | 'manuell'
text        text        max 500 Zeichen
erstellt_von uuid       FK → auth.users (nullable bei System-Events)
created_at  timestamptz
```

Keine Schemaänderung nötig — Tabelle ist bereits vorhanden und korrekt strukturiert.

---

## Was wird geloggt

### Bereits geloggt ✅ (kein Änderungsbedarf)

- Ressource auf Vakanz gespielt
- Link-Status-Änderungen (alle Stufen)
- Zurückziehen
- Verfügbarkeit auto-update bei Beauftragt

### Neu zu loggen (Application-Level in den jeweiligen API-Routen)

| Ereignis | Typ | Beispieltext |
|---|---|---|
| EK-Rate geändert | system | `EK-Rate geändert: 650 € → 700 €/Tag` |
| Skills geändert | system | `Skills aktualisiert: +React, -Angular` |
| Verfügbarkeit geändert | system | `Verfügbarkeit geändert: Nicht verfügbar → Jetzt verfügbar` |
| Verfügbar-ab-Datum geändert | system | `Verfügbar ab geändert: 01.06.2026 → 15.07.2026` |
| Erfahrungslevel geändert | system | `Erfahrungslevel geändert: Mid → Senior` |
| Arbeitsmodell geändert | system | `Arbeitsmodell geändert: Remote → Hybrid` |
| Positionstitel geändert | system | `Rolle geändert: Frontend Developer → Fullstack Developer` |
| Notizen geändert | system | `Notizen aktualisiert` |
| Feedback hinzugefügt | system | `Feedback hinzugefügt (★★★★☆)` |
| Feedback gelöscht | system | `Feedback gelöscht` |
| CV hochgeladen | system | `CV hochgeladen` |
| CV gelöscht | system | `CV gelöscht` |
| Manuelle Notiz | manuell | Freier Text (max 500 Zeichen) |

**Datenschutz:** Name-Felder (vorname, nachname, email etc.) werden nicht mit Vorher/Nachher geloggt — nur „Profil aktualisiert" ohne Wert.

---

## Betroffene API-Routen

| Route | Änderung |
|---|---|
| `PATCH /api/ressourcen/[id]` | Alten Datensatz vor Update laden, geänderte Felder vergleichen, pro Feld einen Historie-Eintrag schreiben |
| `POST /api/ressourcen/[id]/feedback` | Nach erfolgreichem Insert: System-Eintrag mit Bewertung |
| `DELETE /api/ressource-feedback/[id]` | Nach erfolgreichem Delete: System-Eintrag |
| `POST /api/ressourcen/[id]/cv` (Upload) | Nach erfolgreichem Upload: System-Eintrag |
| `DELETE /api/ressourcen/[id]/cv` (falls vorhanden) | Nach erfolgreichem Delete: System-Eintrag |
| `POST /api/ressourcen/[id]/historie` | **Neu** — manuelle Notizen, alle 3 Rollen, Agentur-Ownership-Check |

---

## Berechtigungen

| Aktion | Admin | Manager | Agentur |
|---|---|---|---|
| Verlauf-Tab sehen | ✅ | ✅ | ✅ (nur eigene Ressourcen) |
| Alle Einträge lesen | ✅ | ✅ | ✅ |
| Manuelle Notiz hinzufügen | ✅ | ✅ | ✅ |
| Einträge bearbeiten/löschen | ❌ | ❌ | ❌ |

---

## UI — Verlauf-Tab

**Position:** 4. Tab im RessourceDetailSheet (nach Feedback)

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Details │ Verknüpfungen │ Feedback │ Verlauf         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Notiz hinzufügen...]              [Speichern]     │
│                                                     │
│  ──────────────────────────────────────────────     │
│                                                     │
│  📝  Manuelle Notiz          Max Mustermann         │
│      "Telefonat geführt..."  21. Mai 2026, 14:32    │
│                                                     │
│  ⚙️  EK-Rate geändert        System                 │
│      650 € → 700 €/Tag       21. Mai 2026, 11:15    │
│                                                     │
│  🔗  Status: Interview       Sarah K. (Manager)     │
│      auf Vakanz: UI Designer 20. Mai 2026, 09:00    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Icons nach Typ

| Icon | Bedeutung |
|---|---|
| 📝 | Manuelle Notiz |
| ⚙️ | System-Event (Profil, CV, Feedback) |
| 🔗 | Vakanz-Workflow (Spielen, Status, Zurückziehen) |

### Eintrag-Darstellung

Jeder Eintrag zeigt:
- **Icon** (links)
- **Kurztext / Titel** (fett)
- **Detailtext** (wenn vorhanden, z.B. Vorher → Nachher)
- **Autor** (rechts oben): `System`, oder `Vorname N. (Rolle)`
- **Datum/Uhrzeit** (rechts unten): `21. Mai 2026, 14:32`

### Notiz-Eingabe

- Textarea oben im Tab, max. 500 Zeichen
- Zeichen-Counter
- "Speichern"-Button — disabled wenn leer oder über Limit
- Sichtbar für Admin, Manager, Agentur

### Leerer Zustand

`Noch keine Verlaufseinträge vorhanden.`

---

## Implementierungsreihenfolge

1. `POST /api/ressourcen/[id]/historie` — neuer Endpoint (manuelle Notizen)
2. `PATCH /api/ressourcen/[id]` — Profil-Änderungen loggen
3. `POST /api/ressourcen/[id]/feedback` + `DELETE /api/ressource-feedback/[id]` — Feedback-Events
4. CV-Upload/Delete-Events (falls Endpoints existieren)
5. UI: Verlauf-Tab mit Timeline + Notiz-Eingabe

---

## Nicht im Scope

- Einträge nachträglich bearbeiten oder löschen
- Export des Verlaufs
- Filter/Suche innerhalb des Verlaufs
- Benachrichtigungen bei neuen Einträgen
