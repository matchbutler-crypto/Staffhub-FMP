# PROJ-3: Profil-Einreichung + CV-Upload

## Status: Planned
**Created:** 2026-04-13
**Last Updated:** 2026-04-13

## Dependencies
- Requires: PROJ-1 (Auth & Rollenverwaltung) — für Authentifizierung, Rollenprüfung, `useUser()` Hook
- Requires: PROJ-2 (Vakanzen-CRUD) — Profile werden immer zu einer Vakanz eingereicht

---

## Übersicht

Agenturen können zu offenen Vakanzen ein oder mehrere Kandidaten-Profile einreichen, inklusive PDF-Lebenslauf-Upload via Supabase Storage. Die eingereichten Profile sind für den Staffhub Manager sichtbar. Agenturen können ihre Profile bearbeiten und zurückziehen, solange der Status noch „Eingereicht" ist.

---

## User Stories

**Als Agentur...**
- ...möchte ich alle Vakanzen mit Status „Offen" sehen, damit ich entscheiden kann, zu welchen ich Profile einreiche.
- ...möchte ich zu einer Vakanz ein Kandidatenprofil mit allen Pflichtfeldern und einem PDF-Lebenslauf einreichen.
- ...möchte ich nach Einreichung den Status meines Profils verfolgen (z.B. „Eingereicht", „In Prüfung").
- ...möchte ich ein eigenes eingereichtes Profil bearbeiten (solange Status = „Eingereicht"), um Fehler zu korrigieren.
- ...möchte ich ein eigenes eingereichtes Profil zurückziehen (löschen), solange noch kein Review begonnen hat.
- ...möchte ich eine Warnung sehen, wenn ich denselben Kandidatennamen zur gleichen Vakanz nochmal einreiche.

**Als Staffhub Manager...**
- ...möchte ich alle eingereichten Profile pro Vakanz sehen, sortiert nach Einreichungsdatum.
- ...möchte ich den Lebenslauf eines Kandidaten herunterladen können.
- ...möchte ich Profile verschiedener Agenturen nebeneinander vergleichen (Vakanz-Detailseite).

---

## Acceptance Criteria

### Profil einreichen
- [ ] Agentur sieht auf `/vakanzen` nur Vakanzen mit Status „Offen"
- [ ] Zu jeder offenen Vakanz gibt es einen „Profil einreichen"-Button (nur für Agentur-Rolle sichtbar)
- [ ] Einreichungsformular enthält alle Pflichtfelder laut PRD §3.3.1:
  - Kandidatenname (Text, Pflicht)
  - Verfügbarkeit Stunden/Woche (Zahl, Pflicht)
  - Verfügbar ab (Datum, Pflicht)
  - Verkaufspreis €/Tag (Zahl, Pflicht)
  - Skills/Technologien (Tags, min. 1, Pflicht)
  - Erfahrungslevel (Junior / Mid / Senior / Expert, Pflicht)
  - Kurzbeschreibung/Profiltext (Freitext, Pflicht)
  - Lebenslauf PDF (Upload, max. 10 MB, Pflicht)
  - Kommentar der Agentur (optional)
- [ ] Nach erfolgreichem Upload: Profil erscheint sofort in der Profilliste der Agentur
- [ ] Initialer Status nach Einreichung: „Eingereicht"

### CV-Upload
- [ ] PDF-Upload via Supabase Storage (Bucket: `cv-uploads`)
- [ ] Maximale Dateigröße: 10 MB — Fehler bei Überschreitung
- [ ] Nur PDF-Dateien erlaubt — Fehler bei anderem MIME-Type
- [ ] Dateiname wird serverseitig auf `{profil_id}/{uuid}.pdf` normalisiert (kein Original-Dateiname in Storage)
- [ ] CV-Datei ist nicht öffentlich (kein Public Bucket) — Download nur über signed URL

### Duplikat-Warnung
- [ ] Beim Einreichen: Wenn gleicher Kandidatenname + gleiche Vakanz bereits von dieser Agentur existiert → Warnhinweis anzeigen
- [ ] Agentur kann trotz Warnung einreichen (kein harter Block)

### Profil bearbeiten
- [ ] Agentur kann alle Felder (inkl. CV-Upload) bearbeiten, solange Status = „Eingereicht"
- [ ] Bei Status ≥ „In Prüfung": Bearbeiten-Button ist deaktiviert + Tooltip-Erklärung
- [ ] Neuer CV-Upload ersetzt den alten in Supabase Storage (alter wird gelöscht)

### Profil zurückziehen
- [ ] Agentur kann Profil löschen, solange Status = „Eingereicht"
- [ ] Löschen entfernt auch die CV-Datei aus Supabase Storage
- [ ] Bestätigungs-Dialog vor dem Löschen
- [ ] Bei Status ≥ „In Prüfung": Löschen nicht möglich

### Sichtbarkeit & Isolation
- [ ] Agenturen sehen nur eigene Profile (RLS: `agentur_id = auth_agentur_id`)
- [ ] Staffhub Manager sieht alle Profile aller Agenturen
- [ ] Agentur A sieht nie die Profile von Agentur B (auch nicht Kandidatennamen)
- [ ] `budget_intern` der Vakanz ist für Agenturen nicht sichtbar

### Profilliste Agentur (`/meine-profile`)
- [ ] Alle eigenen Profile mit: Kandidatenname, Vakanz, Status, KI-Score (sobald vorhanden), Einreichungsdatum
- [ ] Filterbar nach: Vakanz, Status, Datum
- [ ] Leerer Zustand wenn noch keine Profile eingereicht

### Profilliste Manager (`/profile`)
- [ ] Alle Profile aller Agenturen, gruppierbar nach Vakanz
- [ ] Spalten: Kandidat, Agentur, Vakanz, Status, KI-Score, Einreichungsdatum
- [ ] Download-Button für CV (signed URL, 60 Minuten gültig)

---

## Edge Cases

- **PDF > 10 MB**: Client-seitige Validierung vor Upload + Server-seitige Ablehnung mit klarer Fehlermeldung
- **Kein PDF hochgeladen**: Formular kann nicht abgeschickt werden (Pflichtfeld)
- **Vakanz wird während Einreichung geschlossen**: API prüft Status der Vakanz zum Zeitpunkt des POST — gibt 409 zurück wenn nicht mehr „Offen"
- **CV-Upload schlägt fehl, Profil-Insert läuft durch**: Transaktion — CV-Upload muss VOR dem DB-Insert erfolgen; bei Upload-Fehler kein Profil-Eintrag
- **Agentur hat keine `agentur_id` im Profil**: Einreichung blockiert, Fehlermeldung „Ihr Account ist keiner Agentur zugeordnet"
- **Download signed URL abgelaufen**: Client zeigt Fehlermeldung, Button triggert neuen signed URL Request
- **Gleichzeitiges Bearbeiten**: Last-Write-Wins; kein Concurrency-Lock nötig (MVP)
- **Sehr langer Kandidatenname / Profiltext**: DB-Limits: Name max. 200 Zeichen, Profiltext max. 5000 Zeichen

---

## Technical Requirements

- **Storage:** Supabase Storage Bucket `cv-uploads` (privat, kein Public Access)
- **RLS:** Profile-Tabelle: Agentur sieht nur eigene Zeilen; Manager sieht alle
- **Dateigröße:** max. 10 MB clientseitig + serverseitig validiert
- **Signed URLs:** 1 Stunde Gültigkeit für CV-Downloads
- **Performance:** Upload-Feedback in Echtzeit (Progress-Indikator)
- **Security:** MIME-Type-Validierung serverseitig (nicht nur Dateiendung)

---

## Tech Design (Solution Architect)

### Komponentenstruktur (UI)

```
/vakanzen (bestehende Seite — erweitert)
└── VakanzCard / VakanzRow
    └── [NEU] Button „Profil einreichen" (nur Agentur-Rolle sichtbar)
        └── ProfilEinreichenSheet (Sheet-Panel, rechts einfahrend)
            ├── Formular (alle Pflichtfelder)
            │   ├── KandidatennameFeld
            │   ├── VerfügbarkeitFeld (Stunden/Woche)
            │   ├── VerfügbarAbFeld (Datepicker)
            │   ├── VerkaufspreisField (€/Tag)
            │   ├── SkillTagInput (wiederverwendet aus PROJ-2)
            │   ├── ErfahrungslevelSelect
            │   ├── ProfilTextarea
            │   ├── [NEU] CVUploadFeld (PDF, max 10 MB)
            │   │   └── UploadProgress (Fortschrittsanzeige)
            │   └── KommentarTextarea (optional)
            ├── [NEU] DuplikatWarnung (Banner, wenn Treffer gefunden)
            └── Formular-Buttons (Abbrechen / Einreichen)

/meine-profile (bestehende Seite — mit echten Daten befüllt)
├── FilterBar (Vakanz, Status, Datum)
├── ProfilTabelle
│   ├── Spalten: Kandidat | Vakanz | Status | KI-Score | Datum
│   └── ProfilRow
│       ├── StatusBadge
│       ├── [NEU] Bearbeiten-Button (nur bei Status = „Eingereicht")
│       └── [NEU] Zurückziehen-Button (nur bei Status = „Eingereicht")
└── LeerZustand (wenn keine Profile vorhanden)

/profile (bestehende Seite — mit echten Daten befüllt, Manager-Sicht)
├── FilterBar (Vakanz, Agentur, Status)
├── ProfilTabelle
│   ├── Spalten: Kandidat | Agentur | Vakanz | Status | KI-Score | Datum
│   └── ProfilRow
│       └── [NEU] CV-Download-Button (löst signed URL aus)
└── LeerZustand
```

---

### Datenmodell

**Tabelle `kandidaten_profile`** (Stub aus PROJ-2 — wird hier vollständig befüllt):

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel, automatisch |
| `vakanz_id` | UUID → vakanzen | Zu welcher Vakanz gehört dieses Profil |
| `agentur_id` | UUID → agenturen | Welche Agentur hat eingereicht |
| `kandidatenname` | Text (max 200) | Name oder Pseudonym des Kandidaten |
| `verfuegbarkeit_stunden` | Integer | Stunden/Woche |
| `verfuegbar_ab` | Datum | Frühester Starttermin |
| `verkaufspreis` | Decimal | Tagessatz in € |
| `skills` | Text[] | Array von Skill-Tags |
| `erfahrungslevel` | Enum | Junior / Mid / Senior / Expert |
| `profiltext` | Text (max 5000) | Kurzbeschreibung |
| `cv_pfad` | Text | Pfad in Supabase Storage (`{id}/{uuid}.pdf`) |
| `kommentar_agentur` | Text | Optional, Freitext |
| `status` | Enum | Eingereicht / In Prüfung / Präsentiert / Interview / Beauftragt / Abgelehnt / Archiviert |
| `ki_score` | Integer | Wird von PROJ-4 befüllt (null bis dahin) |
| `created_at` | Timestamp | Einreichungsdatum, automatisch |
| `updated_at` | Timestamp | Letzte Änderung, automatisch |

**Supabase Storage Bucket `cv-uploads`:**
- Privat (kein öffentlicher Zugriff)
- Dateistruktur: `{profil_id}/{uuid}.pdf`
- Original-Dateiname wird NICHT gespeichert
- Zugriff nur über zeitlich begrenzte signed URLs (1 Stunde)

---

### API-Routen

| Methode | Route | Wer | Was |
|---------|-------|-----|-----|
| `GET` | `/api/profile` | Agentur: eigene; Manager: alle | Profilliste (gefiltert per RLS) |
| `POST` | `/api/profile` | Agentur | Profil einreichen (inkl. CV-Upload) |
| `GET` | `/api/profile/[id]` | Agentur (eigen) / Manager (alle) | Einzelprofil |
| `PUT` | `/api/profile/[id]` | Agentur (nur Status=Eingereicht) | Profil bearbeiten |
| `DELETE` | `/api/profile/[id]` | Agentur (nur Status=Eingereicht) | Profil zurückziehen + CV löschen |
| `GET` | `/api/profile/[id]/cv` | Agentur (eigen) / Manager | Signed URL für CV-Download |
| `GET` | `/api/profile/duplicate-check` | Agentur | Duplikat-Prüfung vor Einreichung |

---

### Upload-Ablauf (Reihenfolge ist sicherheitskritisch)

```
1. Formular abschicken
2. Server: Vakanz-Status prüfen → noch „Offen"? Sonst 409
3. Server: Agentur hat agentur_id? Sonst 403
4. Server: PDF hochladen in Supabase Storage
   → Bei Fehler: Abbruch, kein DB-Eintrag, Fehlermeldung
5. Server: DB-Eintrag anlegen mit cv_pfad
   → Bei Fehler: Storage-Datei wieder löschen (cleanup)
6. Erfolg → Client zeigt neues Profil sofort
```

Diese Reihenfolge verhindert verwaiste DB-Einträge ohne Datei (und umgekehrt).

---

### Zugriffskontrolle (RLS-Policies)

| Aktion | Agentur | Staffhub Manager | Admin |
|--------|---------|-----------------|-------|
| Profile lesen | Nur eigene (`agentur_id` = eigene) | Alle | Alle |
| Profil einreichen | ✅ | ✗ | ✅ |
| Profil bearbeiten | Nur eigene + Status=Eingereicht | ✗ | ✅ |
| Profil löschen | Nur eigene + Status=Eingereicht | ✗ | ✅ |
| CV herunterladen | Nur eigene | Alle | Alle |

Storage RLS: Zugriff auf `cv-uploads/{profil_id}/*` nur wenn Profil zur eigenen Agentur gehört, oder User ist Manager/Admin.

---

### Tech-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Upload über Server-Route** (nicht direkt Client→Storage) | Server kann MIME-Type validieren, Dateigröße erzwingen und Transaktionssicherheit gewährleisten |
| **Signed URLs statt Public Bucket** | CV-Dateien enthalten sensible Personendaten — kein öffentlicher Zugriff |
| **Sheet-Panel statt eigene Seite** | Agentur bleibt im Kontext der Vakanzliste; kein unnötiger Seitennavigation |
| **Duplikat-Check per API-Aufruf** | Prüfung bei `onBlur` des Kandidatennamen-Feldes — kein harter Block, nur Warnung |

---

### Neue Pakete / Abhängigkeiten

| Paket | Zweck |
|-------|-------|
| `react-dropzone` | Drag-and-Drop Dateiupload-UI |

Alle anderen benötigten Komponenten (Sheet, Form, Select, Textarea, Badge, etc.) sind bereits im Projekt vorhanden.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
