# Design: Stammdaten kopieren

**Datum:** 2026-05-28  
**Status:** Approved

---

## Ziel

Im Stammdaten-Tab der Ressourcen-Detailseite wird ein Clipboard-Icon-Button ergänzt. Ein Klick kopiert alle Stammdaten-Felder als strukturierten Text in die Zwischenablage — ohne API-Call, rein client-seitig.

---

## Nicht im Scope

- Per-Feld-Kopierfunktion
- API-Änderungen
- Neue Routen oder Dateien außerhalb von `page.tsx`
- Export-Formate (CSV, JSON)

---

## Betroffene Datei

Nur `src/app/ressourcen/[id]/page.tsx`.

---

## Verhalten

### Sichtbarkeit

Der Button erscheint immer, sobald die Stammdaten-Felder angezeigt werden — unabhängig vom Bearbeiten-Recht. Das bedeutet: sichtbar für Staffhub Manager, Admins und Agentur-User, die Zugriff auf die eigene Ressource haben.

### Kopierformat

Alle 6 Felder als `Label: Wert`-Zeilen, zeilengetrennt:

```
Vorname: Max
Nachname: Mustermann
Geburtsdatum: 01.01.1990
E-Mail: max@example.com
Telefon: +49 123 456789
Wohnort: Berlin
```

- **Reihenfolge:** Vorname, Nachname, Geburtsdatum, E-Mail, Telefon, Wohnort
- **Leere/null-Felder:** werden als `Feldname: —` ausgegeben (nicht weggelassen)
- **Geburtsdatum:** wird wie in der Anzeige formatiert: `new Date(value).toLocaleDateString("de-DE")` — bei leerem Wert `—`

### Feedback

Nach dem Klick wechselt das Icon für 2 Sekunden von `IconCopy` zu `IconCheck` (beide aus `@tabler/icons-react`, bereits importiert). Kein Toast.

---

## UI-Änderungen

### `src/app/ressourcen/[id]/page.tsx`

**1. Hilfsfunktion `buildStammdatenText`**

Eine pure Funktion, die aus dem `ressource`-Objekt den Kopiertext erzeugt:

```ts
function buildStammdatenText(ressource: RessourceDetail): string {
  const fmt = (v: string | null | undefined) => v?.trim() || '—'
  const fmtDate = (v: string | null | undefined) =>
    v ? new Date(v).toLocaleDateString('de-DE') : '—'
  return [
    `Vorname: ${fmt(ressource.vorname)}`,
    `Nachname: ${fmt(ressource.nachname)}`,
    `Geburtsdatum: ${fmtDate(ressource.geburtsdatum)}`,
    `E-Mail: ${fmt(ressource.email)}`,
    `Telefon: ${fmt(ressource.telefon)}`,
    `Wohnort: ${fmt(ressource.wohnort)}`,
  ].join('\n')
}
```

**2. Komponente `CopyStammdatenButton`**

Lokale Komponente in `page.tsx`, erhält das `ressource`-Objekt:

```tsx
function CopyStammdatenButton({ ressource }: { ressource: RessourceDetail }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildStammdatenText(ressource))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied
        ? <IconCheck className="h-3.5 w-3.5 text-green-600" />
        : <IconCopy className="h-3.5 w-3.5" />
      }
      Kopieren
    </Button>
  )
}
```

**3. Einbindung in `StammdatenTab` (read view)**

Der bestehende Bearbeiten-Button ist in `{canEdit && <div className="flex justify-end">…</div>}`. Die Zeile wird zu einem gemeinsamen Header-Block umgebaut, der immer sichtbar ist:

```tsx
<div className="flex justify-end gap-2">
  <CopyStammdatenButton ressource={ressource} />
  {canEdit && (
    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
      <IconPencil className="h-3.5 w-3.5" /> Bearbeiten
    </Button>
  )}
</div>
```

---

## Tests

**Neue Testdatei:** `src/app/ressourcen/[id]/stammdaten-copy.test.ts`

Testet `buildStammdatenText` als pure Funktion (kein DOM, kein Rendering):

| Test | Erwartung |
|---|---|
| Alle Felder befüllt | Korrekte `Label: Wert`-Ausgabe für alle 6 Felder |
| Leere Felder | `Feldname: —` für null/undefined/leere Strings |
| Geburtsdatum-Formatierung | ISO-String `1990-01-01` → `01.01.1990` (de-DE) |
| Feldreihenfolge | Vorname zuerst, Wohnort zuletzt |

---

## Icons

`IconCopy` und `IconCheck` aus `@tabler/icons-react` — bereits in der Datei importiert (prüfen, ggf. ergänzen).

