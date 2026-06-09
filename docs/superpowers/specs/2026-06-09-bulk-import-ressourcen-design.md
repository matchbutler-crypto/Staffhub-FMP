# Bulk Import Ressourcen — Design Spec

**Datum:** 2026-06-09  
**Status:** Approved

---

## Ziel

Agenturen und Manager können mehrere anonyme CVs (PDFs) auf einmal hochladen. Skills werden per OpenAI extrahiert. Anschließend werden die Ressourcen im Wizard-Modal nacheinander mit Pflichtfeldern ergänzt und einzeln gespeichert.

---

## Benutzerfluss

### 1. Einstieg

- Neuer **"Bulk Import"**-Button in der Ressourcen-Übersicht neben "Ressource anlegen"
- Sichtbar für alle Rollen (Admin, Staffhub Manager, Agentur)
- Öffnet ein Sheet-Modal

### 2. Upload-Phase

- Dropzone akzeptiert mehrere PDFs gleichzeitig (drag & drop oder Klick)
- Dateiliste zeigt hochgeladene PDFs mit Name und Dateigröße, einzeln entfernbar
- **Limits:**
  - Agentur: max. 10 PDFs
  - Admin / Staffhub Manager: max. 30 PDFs
  - Pro PDF: max. 10 MB (wie bestehender Einzelupload)
- Validierung im Frontend vor Upload (Anzahl + Dateigröße), klare Fehlermeldungen
- "Importieren"-Button startet den sequenziellen Prozess

### 3. Extraktions-Phase (sequenziell)

- PDFs werden **einzeln nacheinander** per `POST /api/ressourcen/bulk-extract` hochgeladen
- Pro PDF: Upload in Supabase Storage (`ressourcen-cvs/bulk-temp/{agentur_id}/{uuid}.pdf`) + `extractSkillsFromCVBuffer` Aufruf
- Frontend zeigt Echtzeit-Fortschritt: **"PDF 3 von 7 wird analysiert..."** mit Fortschrittsbalken
- Response pro PDF: `{ tempCvPfad: string, skills: string[], index: number }`
- Keine DB-Einträge in dieser Phase
- Nach allen PDFs: automatischer Wechsel in Wizard-Phase

### 4. Wizard-Phase (Abarbeitungs-Phase)

Fortschrittsbalken oben: **"Ressource 1 von 7"**

**Formular pro Ressource (Pflichtfelder mit \*):**

| Feld | Typ | Default | Pflicht |
|------|-----|---------|---------|
| Name | Textfeld | leer | Ja |
| Rolle | Textfeld | leer | Ja |
| Erfahrungslevel | Dropdown (Junior/Mid/Senior/Expert) | — | Ja |
| Skills | Tag-Input (vorausgefüllt aus CV) | extrahierte Skills | Ja (min. 1) |
| Verfügbarkeit | Enum + Datum | `Verfügbar ab` + 1. nächsten Monat | Ja |
| Arbeitsmodell | Dropdown (Onshore/Nearshore/Offshore) | Onshore | Ja |
| EK-Tagesrate | Zahl | leer | Nein |

**Navigation:**
- **"Ressource anlegen & weiter"** → `POST /api/ressourcen` (bestehende Route), CV wird von `bulk-temp/` nach `{agentur_id}/{id}.pdf` verschoben, weiter zur nächsten
- **"Überspringen"** → keine DB-Aktion, temp CV wird markiert zum Löschen, weiter zur nächsten
- **Sheet schließen** → Bestätigungs-Dialog: *"X Ressourcen wurden bereits angelegt. Möchtest du trotzdem schließen? Verbleibende werden verworfen."* → temp CVs der nicht gespeicherten Ressourcen werden gelöscht

### 5. Abschluss

- Sheet schließt sich automatisch nach letzter Ressource
- Toast: **"5 Ressourcen importiert, 2 übersprungen."**
- Ressourcen-Liste refresht sich

---

## API

### `POST /api/ressourcen/bulk-extract`

Nimmt ein einzelnes PDF entgegen, lädt es in Supabase Storage (`bulk-temp/`) hoch, extrahiert Skills via OpenAI.

**Request:** `multipart/form-data`
- `file`: PDF (max. 10 MB)
- `index`: number (für Fortschrittsanzeige)

**Response `200`:**
```json
{
  "tempCvPfad": "bulk-temp/{agentur_id}/{uuid}.pdf",
  "skills": ["React", "TypeScript", "..."],
  "index": 2
}
```

**Auth:** Gleiche Berechtigungsprüfung wie `POST /api/ressourcen` (Admin, Manager, Agentur mit agentur_id)

### `POST /api/ressourcen` (bestehend, unverändert)

Wird pro Ressource im Wizard aufgerufen. Kein Breaking Change.

### Temp-CV-Verschiebung / Bereinigung

- Nach erfolgreichem `POST /api/ressourcen`: Storage-Move von `bulk-temp/` → `{agentur_id}/{id}.pdf`
- Bei Überspringen oder Sheet-Schließen: `DELETE` aus `bulk-temp/`
- Bereinigung der temp files als fire-and-forget nach Sheet-Schließen

---

## Komponenten

| Komponente | Typ | Beschreibung |
|------------|-----|--------------|
| `BulkImportSheet` | Client Component | Haupt-Sheet, verwaltet Phase (upload/extracting/wizard) und State |
| `BulkUploadDropzone` | Client Component | Dropzone mit Dateiliste, Validierung, Limit-Anzeige |
| `BulkExtractionProgress` | Client Component | Fortschrittsbalken während sequenzieller Extraktion |
| `BulkWizardForm` | Client Component | Formular für eine Ressource, nutzt bestehende UI-Komponenten |
| `/api/ressourcen/bulk-extract/route.ts` | API Route | Einzelnes PDF hochladen + Skills extrahieren |

---

## Berechtigungen

| Rolle | Zugriff | Max PDFs |
|-------|---------|----------|
| Admin | Ja | 30 |
| Staffhub Manager | Ja | 30 |
| Agentur | Ja (eigener Pool) | 10 |

---

## Nicht im Scope

- Vakanz-Zuweisung beim Import (wird nachträglich über bestehenden Flow gemacht)
- Stammdaten (Vorname, Nachname, Geburtsdatum etc.) — werden separat im Ressourcen-Detailprofil gepflegt
- Batch-KI-Matching beim Import
