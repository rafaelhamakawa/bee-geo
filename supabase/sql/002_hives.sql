-- GeoApis — módulo de gestão de colmeias (aditivo: não altera nem remove tabelas existentes)

-- =========================
-- Pré-requisitos: papéis de usuário e has_role()
-- (idempotente — não faz nada se já existirem)
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','tecnico','apicultor');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles'
      and policyname = 'user_roles_select_own'
  ) then
    create policy "user_roles_select_own" on public.user_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;



-- =========================
-- Tabela: hives
-- =========================
create table if not exists public.hives (
  id uuid primary key default gen_random_uuid(),
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text,
  origin text check (origin in ('capture','division','purchase')),
  status text not null default 'active' check (status in ('active','inactive')),
  introduced_at date,
  queen_introduced_at date,
  queen_identification text,
  queen_status text,
  purposes text[] not null default '{}',
  cover_photo_path text,
  last_management_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hives_apiary_code_key on public.hives (apiary_id, code);
create index if not exists hives_apiary_id_idx on public.hives (apiary_id);
create index if not exists hives_user_id_idx on public.hives (user_id);
create index if not exists hives_last_management_idx on public.hives (last_management_at);

grant select, insert, update, delete on public.hives to authenticated;
grant all on public.hives to service_role;

-- =========================
-- Tabela: hive_managements
-- =========================
create table if not exists public.hive_managements (
  id uuid primary key default gen_random_uuid(),
  hive_id uuid not null references public.hives(id) on delete cascade,
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  managed_at timestamptz not null default now(),
  responsible text,
  management_type text,
  queen_seen boolean,
  queen_status text,
  colony_strength text,
  occupied_frames integer,
  brood_pattern text,
  food_reserve text,
  temperament text,
  sanitary_status text,
  feeding text,
  treatment text,
  notes text,
  next_review_at date,
  created_at timestamptz not null default now()
);

create index if not exists hive_managements_hive_id_idx on public.hive_managements (hive_id);
create index if not exists hive_managements_apiary_id_idx on public.hive_managements (apiary_id);
create index if not exists hive_managements_user_id_idx on public.hive_managements (user_id);
create index if not exists hive_managements_managed_at_idx on public.hive_managements (managed_at);

grant select, insert, update, delete on public.hive_managements to authenticated;
grant all on public.hive_managements to service_role;

-- =========================
-- Trigger: sincroniza hives.last_management_at
-- =========================
create or replace function public.sync_hive_last_management()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.hive_id, old.hive_id);
begin
  update public.hives h
     set last_management_at = (
           select max(m.managed_at) from public.hive_managements m where m.hive_id = target
         ),
         updated_at = now()
   where h.id = target;
  return null;
end;
$$;

drop trigger if exists hive_managements_sync on public.hive_managements;
create trigger hive_managements_sync
after insert or update or delete on public.hive_managements
for each row execute function public.sync_hive_last_management();

-- updated_at em hives
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists hives_touch_updated_at on public.hives;
create trigger hives_touch_updated_at before update on public.hives
for each row execute function public.touch_updated_at();

-- =========================
-- RLS
-- =========================
alter table public.hives enable row level security;
alter table public.hive_managements enable row level security;

drop policy if exists "hives_select_own" on public.hives;
create policy "hives_select_own" on public.hives for select to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.apiaries a where a.id = hives.apiary_id and a.user_id = auth.uid())
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "hives_insert_own" on public.hives;
create policy "hives_insert_own" on public.hives for insert to authenticated
with check (
  (user_id = auth.uid()
   and exists (select 1 from public.apiaries a where a.id = apiary_id and a.user_id = auth.uid()))
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "hives_update_own" on public.hives;
create policy "hives_update_own" on public.hives for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "hives_delete_own" on public.hives;
create policy "hives_delete_own" on public.hives for delete to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "hive_managements_select_own" on public.hive_managements;
create policy "hive_managements_select_own" on public.hive_managements for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "hive_managements_insert_own" on public.hive_managements;
create policy "hive_managements_insert_own" on public.hive_managements for insert to authenticated
with check (
  (user_id = auth.uid()
   and exists (select 1 from public.hives h where h.id = hive_id and h.user_id = auth.uid()))
  or public.has_role(auth.uid(), 'admin')
);

drop policy if exists "hive_managements_update_own" on public.hive_managements;
create policy "hive_managements_update_own" on public.hive_managements for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "hive_managements_delete_own" on public.hive_managements;
create policy "hive_managements_delete_own" on public.hive_managements for delete to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- =========================
-- Storage: bucket privado hive-photos
-- =========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hive-photos', 'hive-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "hive_photos_select_own" on storage.objects;
create policy "hive_photos_select_own" on storage.objects for select to authenticated
using (bucket_id = 'hive-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hive_photos_insert_own" on storage.objects;
create policy "hive_photos_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'hive-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hive_photos_update_own" on storage.objects;
create policy "hive_photos_update_own" on storage.objects for update to authenticated
using (bucket_id = 'hive-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "hive_photos_delete_own" on storage.objects;
create policy "hive_photos_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'hive-photos' and (storage.foldername(name))[1] = auth.uid()::text);
