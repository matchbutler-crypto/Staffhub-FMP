-- migrations/007_zeitnachweise.sql
-- Zeitnachweis Table with RLS Policies for Billing Dashboard

create table if not exists zeitnachweise (
  id uuid primary key default gen_random_uuid(),
  beauftragung_id uuid not null references beauftragungen(id) on delete cascade,
  monat date not null,
  stunden_ist numeric,
  pdf_path text not null,
  parsed_raw jsonb,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (beauftragung_id, monat)
);

alter table zeitnachweise enable row level security;

create policy "zeitnachweise_manager_all" on zeitnachweise
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and rolle in ('Staffhub Manager', 'Admin', 'Controller')
        and aktiv = true
    )
  );

create policy "zeitnachweise_agentur_own" on zeitnachweise
  for all using (
    exists (
      select 1 from beauftragungen b
      join profiles p on p.id = auth.uid()
      where b.id = zeitnachweise.beauftragung_id
        and b.agentur_id = p.agentur_id
        and p.rolle = 'Agentur'
        and p.aktiv = true
    )
  );
