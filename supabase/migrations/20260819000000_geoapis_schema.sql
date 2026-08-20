-- GeoApis: dados privados por usuário, protegidos por Row Level Security.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.apiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  apiary_id uuid not null,
  user_id uuid not null,
  analyzed_at timestamptz not null default now(),
  biome text not null,
  vegetation_category text not null check (
    vegetation_category in (
      'mata-atlantica', 'floresta-amazonica', 'cerrado', 'pantanal',
      'pampa', 'caatinga', 'monocultura-florifera', 'acacia-mangium'
    )
  ),
  pasture_area_ha numeric(10, 4) not null check (pasture_area_ha between 0 and 706.8584),
  pasture_percentage numeric(8, 4) not null check (pasture_percentage between 0 and 100),
  multiplier smallint not null check (multiplier in (1, 2, 4, 8)),
  hives_before_safety numeric(10, 3) not null check (hives_before_safety >= 0),
  safety_factor numeric(4, 3) not null default 0.85 check (safety_factor between 0 and 1),
  recommended_hives integer not null check (recommended_hives >= 0),
  source text not null,
  source_year smallint check (source_year is null or source_year between 1985 and 2100),
  confidence text check (confidence is null or confidence in ('baixa', 'média', 'alta')),
  methodology_version text not null default 'geoapis-1.0',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint analyses_apiary_owner_fk
    foreign key (apiary_id, user_id) references public.apiaries(id, user_id) on delete cascade
);

create table if not exists public.pasture_fragments (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  user_id uuid not null,
  label text not null check (char_length(label) between 1 and 160),
  area_ha numeric(10, 4) not null check (area_ha > 0 and area_ha <= 706.8584),
  land_cover_class text,
  geometry_geojson jsonb,
  position smallint not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  constraint pasture_fragments_analysis_owner_fk
    foreign key (analysis_id, user_id) references public.analyses(id, user_id) on delete cascade
);

create index if not exists apiaries_user_id_idx on public.apiaries(user_id);
create index if not exists analyses_user_apiary_idx on public.analyses(user_id, apiary_id, analyzed_at desc);
create index if not exists pasture_fragments_analysis_idx on public.pasture_fragments(analysis_id, position);

alter table public.profiles enable row level security;
alter table public.apiaries enable row level security;
alter table public.analyses enable row level security;
alter table public.pasture_fragments enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "apiaries_select_own" on public.apiaries for select to authenticated using ((select auth.uid()) = user_id);
create policy "apiaries_insert_own" on public.apiaries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "apiaries_update_own" on public.apiaries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apiaries_delete_own" on public.apiaries for delete to authenticated using ((select auth.uid()) = user_id);

create policy "analyses_select_own" on public.analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "analyses_insert_own" on public.analyses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "analyses_update_own" on public.analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "analyses_delete_own" on public.analyses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "fragments_select_own" on public.pasture_fragments for select to authenticated using ((select auth.uid()) = user_id);
create policy "fragments_insert_own" on public.pasture_fragments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fragments_update_own" on public.pasture_fragments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fragments_delete_own" on public.pasture_fragments for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists apiaries_set_updated_at on public.apiaries;
create trigger apiaries_set_updated_at before update on public.apiaries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.apiaries to authenticated;
grant select, insert, update, delete on public.analyses to authenticated;
grant select, insert, update, delete on public.pasture_fragments to authenticated;
