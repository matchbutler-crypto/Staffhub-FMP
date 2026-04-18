# PROJ-10: Verfügbarkeits-Reminder (E-Mail Cron)

## Status: Planned
**Created:** 2026-04-18
**Last Updated:** 2026-04-18

## Dependencies
- Requires: PROJ-9 (Freelancer-Pool CRUD) — Ressourcen müssen existieren

## Beschreibung
Wenn eine Pool-Ressource 7 Tage lang nicht aktualisiert wurde (`updated_at` > 7 Tage),
bekommt die zugehörige Agentur automatisch eine E-Mail mit der Bitte,
den Verfügbarkeitsstatus der betroffenen Ressource(n) zu aktualisieren.

"Aktualisieren" bedeutet: jede Änderung an der Ressource (Status, Skills, CV, etc.)
setzt `updated_at` zurück — der Timer startet neu.

Ressourcen mit Status `Deaktiviert` werden nicht erinnert.

## User Stories

- Als Agentur möchte ich automatisch erinnert werden, wenn ich meine Ressourcen zu lange nicht gepflegt habe, damit der Pool immer aktuell bleibt.
- Als Staffhub Manager möchte ich sicher sein, dass veraltete Verfügbarkeitsangaben automatisch gemeldet werden, ohne dass ich es manuell prüfen muss.

## Acceptance Criteria

- [ ] Cron-Job läuft täglich (z.B. 08:00 Uhr)
- [ ] Findet alle Ressourcen mit `updated_at` älter als 7 Tage und Status ≠ "Deaktiviert"
- [ ] Gruppiert betroffene Ressourcen pro Agentur (eine E-Mail pro Agentur, nicht pro Ressource)
- [ ] E-Mail enthält: Liste der veralteten Ressourcen (Name, letzter Status, letztes Update-Datum)
- [ ] E-Mail enthält direkten Link zur Pool-Seite der Agentur
- [ ] Nach dem Versand wird `reminder_sent_at` an der Ressource gesetzt
- [ ] Kein erneuter Versand innerhalb von 24h für dieselbe Ressource (kein Spam)
- [ ] Agentur-E-Mail wird aus dem Agentur-Profil (Supabase Auth) geladen

## Edge Cases

- Agentur hat keine E-Mail-Adresse hinterlegt → Reminder wird übersprungen, Fehler wird geloggt
- E-Mail-Versand schlägt fehl (SMTP-Fehler) → Fehler loggen, `reminder_sent_at` NICHT setzen (nächster Lauf versucht erneut)
- Ressource wird zwischen Cron-Lauf und E-Mail-Versand aktualisiert → `updated_at` frisch, nicht mehr in der Liste → überspringen
- Alle Ressourcen einer Agentur sind deaktiviert → keine E-Mail
- Ressource ist genau 7 Tage alt (Grenzfall) → wird berücksichtigt (≥ 7 Tage)

## Technical Requirements
- Supabase Edge Function (Cron) oder Vercel Cron Route `/api/cron/verfuegbarkeits-reminder`
- Neues Feld `reminder_sent_at TIMESTAMPTZ` in Tabelle `ressourcen`
- E-Mail via Resend oder Supabase Auth E-Mail (SMTP)
- Cron-Secret im Header zur Absicherung gegen unautorisierte Aufrufe
- Logging: Anzahl gesendeter E-Mails + Fehler pro Lauf

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
