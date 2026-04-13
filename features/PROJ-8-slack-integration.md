# PROJ-8: Slack-Integration (Vakanz-Posting via Webhook)

**Status:** In Progress  
**Erstellt:** 2026-04-13  
**Priorität:** P1

---

## Beschreibung

Staffhub Manager kann eine Vakanz per Klick in einen Slack-Channel posten. Technisch via Incoming Webhook (kein Bot-Token nötig). Das Format des Slack-Posts ist ein strukturiertes Block-Kit-Message.

---

## Acceptance Criteria

- [ ] AC-1: Button „In Slack posten" auf der Vakanzen-Seite (nur Manager/Admin)
- [ ] AC-2: POST /api/vakanzen/[id]/slack — sendet Webhook-Request an Slack
- [ ] AC-3: Slack-Nachricht enthält: Titel, Rolle, Skills, Level, Startdatum, Auslastung, Arbeitsmodell
- [ ] AC-4: Slack-Timestamp (ts) wird gespeichert (`slack_ts` auf vakanzen-Tabelle)
- [ ] AC-5: Button wird deaktiviert/gekennzeichnet wenn bereits gepostet (slack_ts vorhanden)
- [ ] AC-6: Fehlermeldung wenn Webhook nicht konfiguriert oder Slack-API Fehler

---

## Tech Design

### Env-Var
`SLACK_WEBHOOK_URL` — Incoming Webhook URL vom Slack-App-Dashboard

### DB-Änderung
`ALTER TABLE vakanzen ADD COLUMN IF NOT EXISTS slack_ts TEXT;`

### API: POST /api/vakanzen/[id]/slack
1. Auth: Manager/Admin only
2. Fetch Vakanz aus DB
3. Baue Slack Block Kit Message
4. POST an `SLACK_WEBHOOK_URL`
5. Speichere Slack-Response (Timestamp) in `vakanzen.slack_ts`

### Slack-Format (Block Kit)
```
*Neue Vakanz: [Titel]*
[Beschreibung, max 300 Zeichen]

Skills: [liste]  |  Level: [level]  |  Modell: [arbeitsmodell]
Start: [datum]  |  Auslastung: [stunden]h/Woche
```

### Dependencies
- Keine neuen npm-Pakete (native fetch)
- Neue Env-Var: `SLACK_WEBHOOK_URL`
