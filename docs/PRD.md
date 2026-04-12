# PRD – Staffhub Freelancer Management Platform

**Produkt:** Staffhub FMP (Freelancer Management Platform)  
**Version:** 0.1 (Draft)  
**Autor:** Easy / Staffhub  
**Datum:** April 2026  
**Status:** In Bearbeitung – Slack-Format für Vakanz-Posts noch ausstehend

---

## 1. Übersicht & Ziel

Staffhub FMP ist eine interne Web-Plattform zur Verwaltung von Freelancer-Vakanzen und Kandidaten-Profilen. Sie verbindet den Staffhub Manager mit externen Freelancer-Agenturen und ermöglicht einen strukturierten, transparenten Prozess vom Vakanzen-Posting bis zur Beauftragung und monatlichen Abrechnung.

### Kernziele

- Vakanzen zentral verwalten und automatisch via Slack an Agenturen kommunizieren
- Agenturen können Profile zu Vakanzen einreichen und den Status tracken
- KI-gestützte Bewertung (Ollama, lokal) jedes eingereichten Profils gegen die Vakanz-Anforderungen
- Staffhub Manager hat vollständige Übersicht über Agenturen, Profile, Status, Margen und Abrechnung
- Rollenbasierter Zugriff: Admin, Staffhub Manager, Agentur

---

## 2. Stakeholder & Rollen

| Rolle | Beschreibung |
|-------|--------------|
| **Admin** | Vollzugriff auf alle Bereiche. Verwaltet User, Rollen, Agenturen und Systemeinstellungen. |
| **Staffhub Manager** | Verwaltet Vakanzen, bewertet Profile, setzt Status, hinterlegt Margen, hat Abrechnungsübersicht. |
| **Agentur** | Kann Vakanzen einsehen, Profile zu Vakanzen einreichen, Status tracken und kommentieren. |

---

## 3. Features & Anforderungen

### 3.1 Benutzerverwaltung (Admin)

- CRUD für alle User (Name, E-Mail, Rolle, Agentur-Zuordnung)
- Zuweisung einer Rolle: Admin / Staffhub Manager / Agentur
- Agenturen sind eigenständige Entitäten; ein Agentur-User gehört immer zu genau einer Agentur
- Aktivieren / Deaktivieren von Accounts
- Passwort-Reset

---

### 3.2 Vakanzen-Management (Staffhub Manager / Admin)

#### 3.2.1 Vakanz erstellen & verwalten

Felder einer Vakanz:

| Feld | Typ | Pflicht |
|------|-----|---------|
| Titel | Text | ✅ |
| Rolle / Jobtitel | Text | ✅ |
| Beschreibung | Freitext (Markdown) | ✅ |
| Geforderte Skills | Tags / Liste | ✅ |
| Erfahrungslevel | Enum (Junior / Mid / Senior / Expert) | ✅ |
| Startdatum | Datum | ✅ |
| Laufzeit / Dauer | Text oder Datum-Range | ✅ |
| Auslastung (Stunden/Woche oder %) | Zahl | ✅ |
| Arbeitsmodell | Enum (Remote / Hybrid / Onsite) | ✅ |
| Standort | Text | optional |
| Internes Budget / Zielrate | Zahl (€/Tag oder €/h) | optional (nur intern sichtbar) |
| Status | Enum (Offen / In Auswahl / Besetzt / Pausiert / Geschlossen) | ✅ |
| Erstellungsdatum | Automatisch | – |

#### 3.2.2 Slack-Posting

- Nach Erstellung/Freigabe einer Vakanz kann der Staffhub Manager diese mit einem Klick in einen konfigurierten Slack-Channel posten
- Das Format des Slack-Posts folgt einem festgelegten Template *(Format wird nachgereicht und hier ergänzt)*
- Die Plattform speichert Slack Message-Timestamp (ts) zur Referenz
- Optional: automatisches Posting bei Status-Wechsel auf "Offen"

---

### 3.3 Profil-Einreichung durch Agenturen

#### 3.3.1 Profil einreichen

- Agentur sieht alle offenen Vakanzen (Status = "Offen")
- Zu einer Vakanz kann die Agentur ein oder mehrere Kandidaten-Profile einreichen
- Felder eines Profils:

| Feld | Typ | Pflicht |
|------|-----|---------|
| Kandidatenname (oder Pseudonym) | Text | ✅ |
| Verfügbarkeit (Stunden/Woche) | Zahl | ✅ |
| Verfügbar ab | Datum | ✅ |
| Verkaufspreis (€/Tag oder €/h) | Zahl | ✅ |
| Skills / Technologien | Tags / Liste | ✅ |
| Erfahrungslevel | Enum | ✅ |
| Kurzbeschreibung / Profil-Text | Freitext | ✅ |
| Lebenslauf / Dokument | PDF-Upload | ✅ |
| Kommentar der Agentur | Freitext | optional |
| Einreichungsdatum | Automatisch | – |

#### 3.3.2 Profil-Tracking (Agentur-Sicht)

- Agentur sieht alle eigenen eingereichten Profile mit aktuellem Status
- Filtermöglichkeiten: nach Vakanz, nach Status, nach Datum
- Kommentare zwischen Agentur und Staffhub Manager sichtbar

---

### 3.4 KI-Bewertung via Ollama (lokal)

#### Trigger

- Automatisch nach jedem Profil-Upload durch eine Agentur
- Optional: manuell re-triggern durch Staffhub Manager

#### Bewertungslogik

Die lokale Ollama-Instanz erhält:
- Die Vakanz-Anforderungen (Rolle, Skills, Erfahrungslevel, Beschreibung)
- Das eingereichte Profil (Skills, Erfahrungslevel, Profiltext, ggf. CV-Text-Extrakt)

Ollama gibt zurück:
- **Match-Score** (0–100)
- **Skill-Coverage** (welche geforderten Skills vorhanden / fehlend)
- **Kurz-Begründung** (2–4 Sätze)
- **Empfehlung** (Enum: Empfohlen / Bedingt geeignet / Nicht geeignet)

#### Darstellung

- Score und Empfehlung werden als Badge/Label am Profil angezeigt
- Vollständige KI-Analyse aufklappbar (Accordion)
- Score-Historie bei Re-Bewertung gespeichert

---

### 3.5 Profil-Management (Staffhub Manager)

#### Status-Workflow eines Profils

```
Eingereicht → In Prüfung → Präsentiert → Interview → Beauftragt → Abgelehnt / Archiviert
```

- Staffhub Manager kann Status jederzeit ändern
- Status-Änderungen werden mit Zeitstempel gespeichert (Audit-Log)
- Agentur sieht den aktuellen Status

#### Kommentarfunktion

- Staffhub Manager und Agentur können Kommentare zu einem Profil hinterlassen
- Kommentare sind chronologisch sortiert (Thread-ähnlich)
- Kommentare sind nicht öffentlich zwischen verschiedenen Agenturen sichtbar (jede Agentur sieht nur eigene Profile + Kommentare)

#### Profil-Download

- Staffhub Manager kann den hochgeladenen Lebenslauf/CV herunterladen
- Alle Profile einer Vakanz als ZIP-Export (optional)

---

### 3.6 Übersicht & Reporting (Staffhub Manager)

#### 3.6.1 Vakanz-Dashboard

- Alle aktiven Vakanzen auf einen Blick
- Pro Vakanz: Anzahl eingereichter Profile, Anzahl pro Status, KI-Durchschnittsscore
- Schnellfilter: nach Status, nach Agentur, nach Startdatum

#### 3.6.2 Agentur-Übersicht (aktive Beauftragungen)

Diese Ansicht zeigt alle aktuell beauftragten Profile, gruppiert nach Agentur.

| Spalte | Beschreibung |
|--------|--------------|
| Agentur | Name der Agentur |
| Kandidat | Name / Pseudonym |
| Vakanz / Rolle | Zugeordnete Vakanz |
| Verfügbarkeit | Stunden/Woche |
| Einkaufspreis (€) | Agentur-Preis (intern hinterlegt durch Staffhub Manager) |
| Margenaufschlag (€) | Variabler Aufschlag in € auf den Agentur-Preis (manuell durch Staffhub Manager) |
| Verkaufspreis (€) | Automatisch berechnet: Agentur-Preis + Margenaufschlag |
| Marge (€ / %) | Entspricht dem Margenaufschlag; % = Aufschlag / Verkaufspreis × 100 |
| Beauftragt seit | Datum |
| Abrechnungsmonat | Aktueller Monat, für den abgerechnet wird |
| Stunden im Monat | Geplante/tatsächliche Stunden (manuell eingebbar) |
| Monatsumsatz | Berechnet: Stunden × Verkaufspreis |
| Monatskosten | Berechnet: Stunden × Einkaufspreis |
| Monatsmarge | Berechnet: Monatsumsatz − Monatskosten |

> **Hinweis:** Einkaufspreis und Marge sind **nur für Staffhub Manager und Admin** sichtbar – nicht für Agenturen.

#### 3.6.3 Monatliche Abrechnung

- Monatsansicht wählbar (z.B. April 2026)
- Aggregierte Ansicht: Summe Umsatz / Kosten / Marge pro Agentur und gesamt
- Export als CSV oder PDF

---

## 4. Nicht-funktionale Anforderungen

| Anforderung | Beschreibung |
|-------------|--------------|
| **Technologie-Stack** | Claude Code + Next.js (App Router) + Supabase (Auth, DB, Storage) |
| **KI-Backend** | Ollama lokal (kein Cloud-Modell für Profildaten) |
| **Datenschutz** | Kandidatendaten dürfen nicht an externe KI-Dienste übermittelt werden |
| **Zugriffsschutz** | Rollenbasierte Zugriffskontrolle (RBAC) auf alle Endpunkte |
| **Slack-Integration** | Slack Bot / Webhook zur Vakanz-Kommunikation |
| **Dateiupload** | PDF-Upload für Lebensläufe, max. 10 MB pro Datei |
| **Sprache** | UI auf Deutsch (primär), englische Feldnamen intern akzeptabel |

---

## 5. Noch offene Punkte / TBD

| # | Punkt | Verantwortlich |
|---|-------|----------------|
| 1 | Slack-Post-Format für Vakanz-Posting | Easy → nachliefern |
| 2 | Tech-Stack: Claude Code + Supabase (Next.js App Router) | ✅ Entschieden |
| 3 | Ollama Modell-Wahl – wird bei Implementierung entschieden | TBD später |
| 4 | Hosting-Umgebung für Ollama – wird bei Implementierung entschieden | TBD später |
| 5 | Kandidaten-Anonymisierung: nicht nötig – Agenturen sehen nur eigene Profile | ✅ Entschieden |
| 6 | Mehrere Staffhub Manager möglich oder nur einer? | Easy |
| 7 | Benachrichtigungen bei Status-Änderungen: keine | ✅ Entschieden |
| 8 | Agenturen sehen KI-Score: ja | ✅ Entschieden |

---

## 6. User Stories (Kurzform)

**Als Staffhub Manager...**
- ...möchte ich eine Vakanz erstellen und sie per Klick in Slack posten, damit alle Agenturen informiert werden.
- ...möchte ich alle eingereichten Profile pro Vakanz sehen, inkl. KI-Score, damit ich schnell entscheiden kann.
- ...möchte ich den Status eines Profils ändern und kommentieren, damit die Agentur informiert bleibt.
- ...möchte ich Einkaufs- und Verkaufspreis hinterlegen, damit die Marge automatisch berechnet wird.
- ...möchte ich eine monatliche Übersicht aller aktiven Beauftragungen mit Margen sehen, damit ich abrechnen kann.

**Als Agentur...**
- ...möchte ich offene Vakanzen sehen und Profile einreichen, inkl. CV-Upload.
- ...möchte ich den Status meiner eingereichten Profile tracken.
- ...möchte ich Kommentare zum Profil hinterlassen und erhalten.

**Als Admin...**
- ...möchte ich alle User und Agenturen anlegen, bearbeiten und deaktivieren.
- ...möchte ich Rollen zuweisen und verwalten.

---

## 7. Anhang

### 7.1 Datenmodell (grob)

```
User          → Rolle, Agentur (optional)
Agentur       → Name, Kontakt, User[]
Vakanz        → Felder s. 3.2.1, Profil[]
Profil        → Felder s. 3.3.1, Vakanz-Ref, Agentur-Ref, KI-Bewertung, Kommentar[]
KI-Bewertung  → Score, Empfehlung, Begründung, Skill-Coverage, Zeitstempel
Kommentar     → Profil-Ref, Autor-Ref (User), Text, Zeitstempel
Beauftragung  → Profil-Ref, Agentur-Preis (€), Margenaufschlag (€), Verkaufspreis (auto), Startdatum, Stunden/Woche
Abrechnung    → Beauftragung-Ref, Monat, Stunden, Umsatz, Kosten, Marge
```

### 7.2 Slack-Post-Format

*(Wird nachgereicht und hier eingefügt)*

```
[PLATZHALTER – Format folgt]
```

---

*Letzte Aktualisierung: April 2026*
