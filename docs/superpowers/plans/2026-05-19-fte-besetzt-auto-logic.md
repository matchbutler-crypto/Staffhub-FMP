# FTE-Besetzt Auto-Logik Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wenn die Anzahl der Beauftragt-Ressourcen für eine Vakanz die `fte_anzahl` erreicht, wird die Vakanz automatisch auf "Besetzt" gesetzt und für Agenturen unsichtbar. Wird eine Beauftragung vom Admin rückgängig gemacht, fällt die Vakanz in den Entwurfsmodus (Status "Offen", `published = false`).

**Architecture:** Die gesamte Logik sitzt in der PATCH-Route `ressource-links/[id]/status`. Nach dem bestehenden Status-Update wird geprüft, ob der neue Status 'Beauftragt' ist (Pfad 1) oder ob der alte Status 'Beauftragt' war (Pfad 2). Entsprechend wird die Vakanz automatisch aktualisiert und ein Historien-Eintrag geschrieben.

**Tech Stack:** Next.js 15 App Router, Supabase (server-side client), TypeScript, Zod

---

## Files

- Modify: `src/app/api/ressource-links/[id]/status/route.ts` — einzige Änderungsstelle

---

### Task 1: Pfad 1 — Vakanz auf "Besetzt" setzen wenn FTE-Ziel erreicht

**Files:**
- Modify: `src/app/api/ressource-links/[id]/status/route.ts`

Kontext: Die Datei endet aktuell mit dem Block der Verfügbarkeits-Automatik (`if (newStatus === 'Beauftragt' && vakanzEnddatum) { ... }`). Direkt danach kommt `return NextResponse.json({ link: updated })`. Der neue Code wird zwischen dem Historien-Block und dem `return` eingefügt.

Die Vakanz-ID ist in `link.vakanz_id` verfügbar. `fte_anzahl` muss aus der `vakanzen`-Tabelle geladen werden. Der Vergleich ist `count >= fte_anzahl` (Raw-Vergleich, kein Floor).

- [ ] **Schritt 1: FTE-Check-Block nach der Verfügbarkeits-Automatik einfügen**

Ersetze in `src/app/api/ressource-links/[id]/status/route.ts` den abschließenden `return`-Block:

```typescript
// Vorher (ganz am Ende der Funktion):
  return NextResponse.json({ link: updated })
}
```

durch:

```typescript
  // Pfad 1 — Vakanz automatisch auf "Besetzt" setzen wenn FTE-Ziel erreicht
  if (newStatus === 'Beauftragt') {
    const [{ count: beauftragtCount }, { data: vakanz }] = await Promise.all([
      supabase
        .from('ressource_vakanz_links')
        .select('*', { count: 'exact', head: true })
        .eq('vakanz_id', link.vakanz_id)
        .eq('status', 'Beauftragt'),
      supabase
        .from('vakanzen')
        .select('status, fte_anzahl')
        .eq('id', link.vakanz_id)
        .single(),
    ])

    const fte = vakanz?.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
    const count = beauftragtCount ?? 0

    if (fte !== null && count >= fte && vakanz?.status !== 'Besetzt') {
      await supabase
        .from('vakanzen')
        .update({
          status: 'Besetzt',
          published: false,
          besetzt_seit: new Date().toISOString(),
        })
        .eq('id', link.vakanz_id)

      await supabase.from('ressource_historie').insert({
        ressource_id: link.ressource_id,
        link_id: id,
        typ: 'system',
        text: `Vakanz automatisch auf "Besetzt" gesetzt — FTE-Ziel erreicht (${count}/${fte})`,
        erstellt_von: user.id,
      })
    }
  }

  return NextResponse.json({ link: updated })
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Erwartet: keine Ausgabe (kein Fehler)

- [ ] **Schritt 3: Manuell testen — Pfad 1**

1. Öffne eine Vakanz mit `fte_anzahl = 1` in der DB:
```sql
UPDATE vakanzen SET fte_anzahl = 1 WHERE id = '290499d7-045b-49e1-8750-84f62ccdd26c';
```
2. Setze die Ressource "Marc Matt" (link_id: `66bca030-a5c6-4b0f-ad9c-03a6cf74d46e`) im Manager-UI auf "Beauftragt" (Rohpreis eintragen, speichern)
3. Prüfe in DB:
```sql
SELECT status, published, besetzt_seit FROM vakanzen WHERE id = '290499d7-045b-49e1-8750-84f62ccdd26c';
```
Erwartet: `status = 'Besetzt'`, `published = false`, `besetzt_seit` gesetzt

4. Als Agentur-User: Vakanz sollte in der Übersicht nicht mehr erscheinen

- [ ] **Schritt 4: Commit**

```bash
git add src/app/api/ressource-links/[id]/status/route.ts
git commit -m "feat: auto-set vakanz to Besetzt when FTE target reached"
```

---

### Task 2: Pfad 2 — Vakanz auf "Offen" (Entwurf) zurücksetzen wenn Beauftragung rückgängig

**Files:**
- Modify: `src/app/api/ressource-links/[id]/status/route.ts`

Kontext: Wenn der *alte* Link-Status `'Beauftragt'` war (d.h. `link.status === 'Beauftragt'`) und der neue Status nicht 'Beauftragt' ist (dieser Fall ist nur dem Admin erlaubt, da die bestehende Guard-Logik das bereits sicherstellt), muss geprüft werden ob die Vakanz aktuell "Besetzt" ist und ob durch die Rücknahme die FTE-Zahl unterschritten wird.

Der Block kommt direkt nach dem Pfad-1-Block, vor dem `return`.

- [ ] **Schritt 1: Pfad-2-Block einfügen**

Füge direkt nach dem `if (newStatus === 'Beauftragt') { ... }` Block und vor `return NextResponse.json({ link: updated })` ein:

```typescript
  // Pfad 2 — Vakanz zurück auf "Offen" (Entwurf) wenn Beauftragung rückgängig
  if (link.status === 'Beauftragt' && newStatus !== 'Beauftragt') {
    const { data: vakanz } = await supabase
      .from('vakanzen')
      .select('status, fte_anzahl')
      .eq('id', link.vakanz_id)
      .single()

    if (vakanz?.status === 'Besetzt') {
      const { count: beauftragtCount } = await supabase
        .from('ressource_vakanz_links')
        .select('*', { count: 'exact', head: true })
        .eq('vakanz_id', link.vakanz_id)
        .eq('status', 'Beauftragt')

      const fte = vakanz.fte_anzahl != null ? Number(vakanz.fte_anzahl) : null
      const count = beauftragtCount ?? 0

      if (fte !== null && count < fte) {
        await supabase
          .from('vakanzen')
          .update({ status: 'Offen', published: false })
          .eq('id', link.vakanz_id)

        await supabase.from('ressource_historie').insert({
          ressource_id: link.ressource_id,
          link_id: id,
          typ: 'system',
          text: `Vakanz auf "Offen" (Entwurf) gesetzt — Beauftragung rückgängig gemacht (${count}/${fte ?? '?'} FTE)`,
          erstellt_von: user.id,
        })
      }
    }
  }
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd "/Users/A200296225/Desktop/Projekt/StaffHub FMP" && npx tsc --noEmit
```

Erwartet: keine Ausgabe (kein Fehler)

- [ ] **Schritt 3: Manuell testen — Pfad 2**

Voraussetzung: Task 1 abgeschlossen, Vakanz ist "Besetzt".

1. Als Admin: Setze den Link-Status von "Beauftragt" auf einen anderen Status (z.B. "Zugesagt")
2. Prüfe in DB:
```sql
SELECT status, published FROM vakanzen WHERE id = '290499d7-045b-49e1-8750-84f62ccdd26c';
```
Erwartet: `status = 'Offen'`, `published = false`

3. Als Agentur: Vakanz erscheint weiterhin nicht (da `published = false`)
4. Manager öffnet Vakanz-Detailseite, klickt "Publizieren" — Vakanz erscheint wieder für Agenturen

- [ ] **Schritt 4: Commit**

```bash
git add src/app/api/ressource-links/[id]/status/route.ts
git commit -m "feat: revert vakanz to Offen draft when Beauftragt is undone by Admin"
```

---

### Task 3: Push & Verifikation

- [ ] **Schritt 1: Push zu Production**

```bash
git push origin master
```

- [ ] **Schritt 2: End-to-End-Verifikation in Production**

1. Vakanz mit `fte_anzahl = 1` in Prod-DB setzen (oder neue Vakanz mit 1 FTE anlegen)
2. Ressource im Manager-UI auf "Beauftragt" setzen → Beauftragungsmodal ausfüllen → speichern
3. Prüfen: Vakanz-Übersicht zeigt "Besetzt" für Manager
4. Prüfen: Agentur sieht die Vakanz nicht mehr
5. Admin setzt Link zurück auf "Zugesagt"
6. Prüfen: Vakanz-Status "Offen", `published = false`
7. Manager publiziert Vakanz manuell → Agentur sieht sie wieder
