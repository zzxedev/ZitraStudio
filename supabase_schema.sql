-- =============================================================
-- ZitraDev Ticket System — Supabase schema
-- 1) Remplace admin@exemple.com par TON e-mail.
-- 2) Exécute TOUT ce fichier dans Supabase > SQL Editor.
-- =============================================================

create extension if not exists pgcrypto;

create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- >>> CHANGE CETTE ADRESSE <<<
insert into public.admins(email)
values (lower('zzxedev@gmail.com'))
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  customer_name text not null,
  discord text,
  service text not null,
  title text not null,
  budget text,
  deadline text,
  description text not null,
  references_text text,
  status text not null default 'new'
    check (status in ('new','in_progress','waiting_client','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  message_id uuid references public.ticket_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index if not exists tickets_user_id_idx on public.tickets(user_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_updated_at_idx on public.tickets(updated_at desc);
create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages(ticket_id,created_at);
create index if not exists ticket_attachments_ticket_id_idx on public.ticket_attachments(ticket_id);

create or replace function public.touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets set updated_at = now()
  where id = coalesce(new.ticket_id, new.id);
  return new;
end;
$$;

drop trigger if exists ticket_message_touch on public.ticket_messages;
create trigger ticket_message_touch
after insert on public.ticket_messages
for each row execute function public.touch_ticket();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists tickets_updated_at on public.tickets;
create trigger tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

alter table public.admins enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_attachments enable row level security;

drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self" on public.admins
for select to authenticated
using (email = lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists "tickets_select_owner_or_admin" on public.tickets;
create policy "tickets_select_owner_or_admin" on public.tickets
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "tickets_insert_owner" on public.tickets;
create policy "tickets_insert_owner" on public.tickets
for insert to authenticated
with check (
  user_id = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt()->>'email',''))
);

drop policy if exists "tickets_update_admin" on public.tickets;
create policy "tickets_update_admin" on public.tickets
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "messages_select_access" on public.ticket_messages;
create policy "messages_select_access" on public.ticket_messages
for select to authenticated
using (
  public.is_admin()
  or (
    not is_internal and exists(
      select 1 from public.tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  )
);

drop policy if exists "messages_insert_access" on public.ticket_messages;
create policy "messages_insert_access" on public.ticket_messages
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists(
    select 1 from public.tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
  )
  and (not is_internal or public.is_admin())
);

drop policy if exists "attachments_select_access" on public.ticket_attachments;
create policy "attachments_select_access" on public.ticket_attachments
for select to authenticated
using (
  exists(
    select 1 from public.tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
  )
  and (
    public.is_admin()
    or message_id is null
    or exists(
      select 1 from public.ticket_messages m
      where m.id = message_id and not m.is_internal
    )
  )
);

drop policy if exists "attachments_insert_access" on public.ticket_attachments;
create policy "attachments_insert_access" on public.ticket_attachments
for insert to authenticated
with check (
  uploader_id = auth.uid()
  and exists(
    select 1 from public.tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
  )
);

-- Bucket privé pour les fichiers joints : 10 Mo par fichier.
insert into storage.buckets(id,name,public,file_size_limit)
values ('ticket-files','ticket-files',false,10485760)
on conflict (id) do update set public=false,file_size_limit=10485760;

drop policy if exists "ticket_files_read" on storage.objects;
create policy "ticket_files_read" on storage.objects
for select to authenticated
using (
  bucket_id='ticket-files'
  and exists(
    select 1 from public.tickets t
    where t.id::text = (storage.foldername(name))[1]
      and (t.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "ticket_files_insert" on storage.objects;
create policy "ticket_files_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id='ticket-files'
  and exists(
    select 1 from public.tickets t
    where t.id::text = (storage.foldername(name))[1]
      and (t.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "ticket_files_delete_admin" on storage.objects;
create policy "ticket_files_delete_admin" on storage.objects
for delete to authenticated
using (bucket_id='ticket-files' and public.is_admin());
