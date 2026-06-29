-- supabase/migrations/bug_reports.sql

-- Tabelle
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  beschreibung text not null,
  screenshot_url text,
  seite_url   text not null,
  status      text not null default 'offen'
                check (status in ('offen', 'in_bearbeitung', 'erledigt')),
  melder_id   uuid not null references public.profiles(id) on delete set null,
  melder_rolle text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at Trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bug_reports_updated_at
  before update on public.bug_reports
  for each row execute procedure public.set_updated_at();

-- RLS aktivieren
alter table public.bug_reports enable row level security;

-- INSERT: alle aktiven eingeloggten User
create policy "bug_reports_insert" on public.bug_reports
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and aktiv = true
    )
  );

-- SELECT: nur Admin
create policy "bug_reports_select_admin" on public.bug_reports
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );

-- UPDATE: nur Admin
create policy "bug_reports_update_admin" on public.bug_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );

-- Storage Bucket anlegen
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', false)
on conflict do nothing;

-- Upload: alle aktiven eingeloggten User
create policy "bug_screenshots_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bug-screenshots'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and aktiv = true
    )
  );

-- Download: nur Admin
create policy "bug_screenshots_select_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bug-screenshots'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and rolle = 'Admin'
    )
  );
