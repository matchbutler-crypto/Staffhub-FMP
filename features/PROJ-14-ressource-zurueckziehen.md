# PROJ-14: Ressource zurückziehen (Agentur zieht Einreichung zurück)

**Status:** In Progress  
**Erstellt:** 2026-04-19  
**Priorität:** P1

---

## Beschreibung

Agenturen können eine bereits auf eine Vakanz gespielte Ressource zurückziehen, solange der Status noch nicht „Zugesagt" oder „Beauftragt" ist. Der Rückzug setzt den `ressource_vakanz_links`-Status auf „Zurückgezogen" und benachrichtigt den Staffhub Manager passiv (Statusanzeige in der Vakanz-Pipeline).

---

## User Stories

1. Als Agentur möchte ich eine Ressource, die ich versehentlich oder nicht mehr passend auf eine Vakanz gespielt habe, zurückziehen können, damit der Manager keine irreführenden Profile sieht.
2. Als Agentur möchte ich beim Zurückziehen einen optionalen Grund angeben können, damit die Kommunikation transparent bleibt.
3. Als Staffhub Manager möchte ich zurückgezogene Ressourcen in der Vakanz-Pipeline erkennbar sehen (Status „Zurückgezogen"), damit ich den Prozess nachvollziehen kann.
4. Als Agentur möchte ich in meiner Pool-Übersicht den Status „Zurückgezogen" pro Vakanz sehen, damit ich den Überblick behalte.

---

## Acceptance Criteria

- [ ] AC-1: In der Pool-Detailansicht einer Ressource (Sheet, Tab „Vakanzen") gibt es pro Vakanz-Link einen „Zurückziehen"-Button
- [ ] AC-2: Der Button ist nur aktiv wenn Status ∈ {„Profil gespielt", „In Prüfung"} — nicht bei „Interview geplant", „Zugesagt", „Abgesagt", „Abgelehnt", „Zurückgezogen"
- [ ] AC-3: Klick öffnet einen Bestätigungs-Dialog mit optionalem Freitext-Feld „Grund (optional)"
- [ ] AC-4: Nach Bestätigung wird `ressource_vakanz_links.status` auf „Zurückgezogen" gesetzt + `grund_rueckzug` Text gespeichert
- [ ] AC-5: Der Staffhub Manager sieht in der Vakanz-Pipeline den Status „Zurückgezogen" mit grauem Badge
- [ ] AC-6: Zurückgezogene Einträge können vom Manager nicht mehr weiter in den Workflow geschoben werden
- [ ] AC-7: Die Ressource im Pool bleibt erhalten (nur der Vakanz-Link-Status ändert sich)
- [ ] AC-8: In der Ressourcen-Historie wird der Rückzug automatisch eingetragen (Systemeintrag, analog zu PROJ-11)

---

## Edge Cases

- Status ist bereits weiter fortgeschritten (Interview / Zugesagt) → Button deaktiviert mit Tooltip „Rückzug nicht mehr möglich bei aktuellem Status"
- Gleichzeitiger Statuswechsel durch Manager (Race Condition) → API prüft erlaubte Status vor dem Update; bei Konflikt gibt API 409; Dialog zeigt Fehlermeldung
- Agentur versucht Ressource einer anderen Agentur zurückzuziehen → RLS verhindert (403)
- Netzwerkfehler → Retry möglich; kein inkonsistenter Zustand da atomare DB-Operation

---

## Schema-Erweiterung

```sql
-- Neues Status-Enum-Value für ressource_vakanz_links:
-- 'Zurückgezogen'

-- Neues optionales Textfeld:
ALTER TABLE ressource_vakanz_links ADD COLUMN grund_rueckzug TEXT;
```

---

## Dependencies

- Requires: PROJ-11 (Ressource auf Vakanz spielen + Status-Workflow) — `ressource_vakanz_links` Tabelle mit Status-Feld
- Requires: PROJ-9 (Freelancer-Pool CRUD) — Pool-Ansicht als Einstiegspunkt

---

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
Pool-Seite (bestehend)
└── Ressource-DetailSheet (bestehend, Tab "Vakanzen")
    └── Vakanz-Zeile (bestehend: Status-Badge, Vakanz-Name)
        └── "Zurückziehen"-Button  ← NEU
            (nur aktiv: Agentur-Rolle + Status = "Gespielt")
            └── RueckzugDialog  ← NEU (shadcn AlertDialog)
                ├── Bestätigungstext
                ├── Textarea "Grund (optional)"
                └── Buttons: "Abbrechen" / "Zurückziehen"
```

### Datenmodell

Zwei Änderungen an der bestehenden `ressource_vakanz_links`-Tabelle — keine neue Tabelle:

| Änderung | Details |
|---|---|
| Neuer Status-Wert | `'Zurückgezogen'` zur Check-Constraint hinzufügen |
| Neues Feld | `grund_rueckzug TEXT` (nullable, optional) |

### API

Neuer dedizierter Endpunkt (kein Umbau des bestehenden Manager-Status-Endpoints):

| Endpunkt | Rolle | Aktion |
|---|---|---|
| `PATCH /api/ressource-links/[id]/rueckzug` | Agentur | Setzt Status auf "Zurückgezogen" + speichert Grund |

Ablauf im Backend:
1. Auth-Check (401 wenn nicht eingeloggt)
2. Profil laden → nur Agentur darf (403 sonst)
3. Link laden + Ressource prüfen → `ressource.agentur_id === profile.agentur_id` (403 sonst)
4. Status-Validierung: nur `Gespielt` erlaubt (409 wenn bereits weiter)
5. UPDATE `ressource_vakanz_links` (atomisch)
6. INSERT `ressource_historie` (System-Eintrag)

### Status-Übergang

```
Zurückziehbar:  Gespielt → Zurückgezogen
Gesperrt:       Interview geplant, Zugesagt, Abgesagt, Abgelehnt
Manager-Ansicht: "Zurückgezogen" = grauer Badge, keine weiteren Aktionen möglich
```

### Tech-Entscheidungen

**Eigener Endpunkt statt Erweiterung des Manager-Status-Endpoints:** Der bestehende `PATCH /api/ressource-links/[id]/status` ist Manager-only mit Vorwärts-Workflow. Rückzug als separater Endpunkt hält die Zugriffslogik klar getrennt.

**AlertDialog statt Dialog:** Rückzug ist eine destruktive Aktion. AlertDialog kommuniziert das visuell klarer.

**Atomarität:** Ein einzelnes DB-Update, kein Rollback-Szenario nötig.

### Neue Pakete

Keine — `AlertDialog`, `Textarea`, `Badge` sind bereits installiert.
