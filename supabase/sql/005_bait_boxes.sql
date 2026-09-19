-- GeoApis — caixas isca (armadilhas de enxame)
-- Cole este script no SQL Editor do Supabase e execute.

create table if not exists public.bait_boxes (
  id uuid primary key default gen_random_uuid(),
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'installed',
  photo_path text,
  notes text,
  installed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apiary_id, code)
);

create index if not exists bait_boxes_apiary_idx on public.bait_boxes (apiary_id);

grant select, insert, update, delete on public.bait_boxes to authenticated;
grant all on public.bait_boxes to service_role;

alter table public.bait_boxes enable row level security;

drop policy if exists "bait_boxes_select_own" on public.bait_boxes;
create policy "bait_boxes_select_own" on public.bait_boxes for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "bait_boxes_insert_own" on public.bait_boxes;
create policy "bait_boxes_insert_own" on public.bait_boxes for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "bait_boxes_update_own" on public.bait_boxes;
create policy "bait_boxes_update_own" on public.bait_boxes for update to authenticated
using (auth.uid() = user_id);

drop policy if exists "bait_boxes_delete_own" on public.bait_boxes;
create policy "bait_boxes_delete_own" on public.bait_boxes for delete to authenticated
using (auth.uid() = user_id);

-- updated_at automático (reutiliza a função criada em 002_hives.sql, se existir)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bait_boxes_touch on public.bait_boxes;
create trigger bait_boxes_touch before update on public.bait_boxes
for each row execute function public.touch_updated_at();
