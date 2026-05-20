create table if not exists rechnungen (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null,
  gesamtbetrag numeric not null,
  status text not null default 'Entwurf',
  betrag_bezahlt numeric default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  unique (beauftragung_id, monat)
);

alter table rechnungen enable row level security;

create policy "rechnungen_manager_all" on rechnungen
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and rolle in ('Staffhub Manager', 'Admin', 'Controller')
        and aktiv = true
    )
  );

create policy "rechnungen_agentur_own" on rechnungen
  for select using (
    exists (
      select 1 from beauftragungen b
      join profiles p on p.id = auth.uid()
      where b.id = rechnungen.beauftragung_id
        and b.agentur_id = p.agentur_id
        and p.rolle = 'Agentur'
        and p.aktiv = true
    )
  );
