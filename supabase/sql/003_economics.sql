-- GeoApis — módulo de Gestão Econômica do Apiário
-- Migration aditiva: não altera nem remove tabelas existentes.

-- Função de updated_at (reutiliza a existente; cria se ainda não existir)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- =========================================================
-- 1) Produção por colmeia
-- =========================================================
create table if not exists public.hive_production_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  hive_id uuid not null references public.hives(id) on delete cascade,
  product_type text not null check (product_type in ('honey','propolis','pollen','wax')),
  quantity_kg numeric(12,3) not null check (quantity_kg >= 0),
  produced_at date not null default current_date,
  lot_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hpr_user_idx on public.hive_production_records (user_id);
create index if not exists hpr_apiary_idx on public.hive_production_records (apiary_id);
create index if not exists hpr_hive_idx on public.hive_production_records (hive_id);
create index if not exists hpr_date_idx on public.hive_production_records (produced_at);

grant select, insert, update, delete on public.hive_production_records to authenticated;
grant all on public.hive_production_records to service_role;

drop trigger if exists hpr_touch on public.hive_production_records;
create trigger hpr_touch before update on public.hive_production_records
for each row execute function public.touch_updated_at();

-- =========================================================
-- 2) Vendas do apiário
-- =========================================================
create table if not exists public.apiary_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  hive_id uuid references public.hives(id) on delete set null,
  product_type text not null check (product_type in ('honey','propolis','pollen','wax')),
  sale_date date not null default current_date,
  quantity_kg numeric(12,3) not null check (quantity_kg >= 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  buyer text,
  sales_channel text,
  lot_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_user_idx on public.apiary_sales (user_id);
create index if not exists sales_apiary_idx on public.apiary_sales (apiary_id);
create index if not exists sales_hive_idx on public.apiary_sales (hive_id);
create index if not exists sales_date_idx on public.apiary_sales (sale_date);

grant select, insert, update, delete on public.apiary_sales to authenticated;
grant all on public.apiary_sales to service_role;

drop trigger if exists sales_touch on public.apiary_sales;
create trigger sales_touch before update on public.apiary_sales
for each row execute function public.touch_updated_at();

-- =========================================================
-- 3) Gastos do apiário
-- =========================================================
create table if not exists public.apiary_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apiary_id uuid not null references public.apiaries(id) on delete cascade,
  occurred_at date not null default current_date,
  category text not null,
  cost_type text not null default 'variable' check (cost_type in ('fixed','variable')),
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  supplier text,
  payment_method text,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_idx on public.apiary_expenses (user_id);
create index if not exists expenses_apiary_idx on public.apiary_expenses (apiary_id);
create index if not exists expenses_date_idx on public.apiary_expenses (occurred_at);
create index if not exists expenses_category_idx on public.apiary_expenses (category);

grant select, insert, update, delete on public.apiary_expenses to authenticated;
grant all on public.apiary_expenses to service_role;

drop trigger if exists expenses_touch on public.apiary_expenses;
create trigger expenses_touch before update on public.apiary_expenses
for each row execute function public.touch_updated_at();

-- =========================================================
-- 4) Cotações do mel (cache FIPMEL)
-- =========================================================
create table if not exists public.honey_price_quotes (
  id uuid primary key default gen_random_uuid(),
  region text,
  state text,
  honey_type text,
  price_min numeric(12,2) check (price_min >= 0),
  price_avg numeric(12,2) check (price_avg >= 0),
  price_max numeric(12,2) check (price_max >= 0),
  unit text not null default 'R$/kg',
  reference_date date,
  source_name text not null default 'Índice FIPMEL',
  source_url text not null default 'https://mel.com.br/fipmel/',
  fetched_at timestamptz not null default now(),
  status text not null default 'ok' check (status in ('ok','stale','error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_state_idx on public.honey_price_quotes (state);
create index if not exists quotes_region_idx on public.honey_price_quotes (region);
create index if not exists quotes_ref_idx on public.honey_price_quotes (reference_date);

grant select on public.honey_price_quotes to authenticated;
grant all on public.honey_price_quotes to service_role;

drop trigger if exists quotes_touch on public.honey_price_quotes;
create trigger quotes_touch before update on public.honey_price_quotes
for each row execute function public.touch_updated_at();

-- =========================================================
-- RLS
-- =========================================================
alter table public.hive_production_records enable row level security;
alter table public.apiary_sales enable row level security;
alter table public.apiary_expenses enable row level security;
alter table public.honey_price_quotes enable row level security;

-- Produção
drop policy if exists hpr_select on public.hive_production_records;
create policy hpr_select on public.hive_production_records for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists hpr_insert on public.hive_production_records;
create policy hpr_insert on public.hive_production_records for insert to authenticated
with check (
  (user_id = auth.uid()
   and exists (select 1 from public.apiaries a where a.id = apiary_id and a.user_id = auth.uid())
   and exists (select 1 from public.hives h where h.id = hive_id and h.apiary_id = apiary_id))
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

drop policy if exists hpr_update on public.hive_production_records;
create policy hpr_update on public.hive_production_records for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists hpr_delete on public.hive_production_records;
create policy hpr_delete on public.hive_production_records for delete to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Vendas
drop policy if exists sales_select on public.apiary_sales;
create policy sales_select on public.apiary_sales for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists sales_insert on public.apiary_sales;
create policy sales_insert on public.apiary_sales for insert to authenticated
with check (
  (user_id = auth.uid()
   and exists (select 1 from public.apiaries a where a.id = apiary_id and a.user_id = auth.uid()))
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

drop policy if exists sales_update on public.apiary_sales;
create policy sales_update on public.apiary_sales for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists sales_delete on public.apiary_sales;
create policy sales_delete on public.apiary_sales for delete to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Gastos
drop policy if exists expenses_select on public.apiary_expenses;
create policy expenses_select on public.apiary_expenses for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists expenses_insert on public.apiary_expenses;
create policy expenses_insert on public.apiary_expenses for insert to authenticated
with check (
  (user_id = auth.uid()
   and exists (select 1 from public.apiaries a where a.id = apiary_id and a.user_id = auth.uid()))
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

drop policy if exists expenses_update on public.apiary_expenses;
create policy expenses_update on public.apiary_expenses for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists expenses_delete on public.apiary_expenses;
create policy expenses_delete on public.apiary_expenses for delete to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Cotações: leitura para autenticados, escrita apenas para admin (ou service_role/Edge Function)
drop policy if exists quotes_select on public.honey_price_quotes;
create policy quotes_select on public.honey_price_quotes for select to authenticated using (true);

drop policy if exists quotes_insert on public.honey_price_quotes;
create policy quotes_insert on public.honey_price_quotes for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists quotes_update on public.honey_price_quotes;
create policy quotes_update on public.honey_price_quotes for update to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists quotes_delete on public.honey_price_quotes;
create policy quotes_delete on public.honey_price_quotes for delete to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================
-- Resumo econômico por apiário / usuário / período
-- security invoker: respeita RLS do chamador (nunca mistura apiários)
-- =========================================================
create or replace function public.apiary_economic_summary(
  _apiary_id uuid,
  _start date,
  _end date
)
returns table (
  apiary_id uuid,
  revenue numeric,
  costs numeric,
  fixed_costs numeric,
  variable_costs numeric,
  profit numeric,
  honey_produced_kg numeric,
  honey_sold_kg numeric,
  honey_revenue numeric,
  productive_hives integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with s as (
    select coalesce(sum(gross_amount),0) rev,
           coalesce(sum(case when product_type='honey' then gross_amount else 0 end),0) honey_rev,
           coalesce(sum(case when product_type='honey' then quantity_kg else 0 end),0) honey_sold
      from public.apiary_sales
     where apiary_id = _apiary_id and sale_date between _start and _end
  ), e as (
    select coalesce(sum(amount),0) total,
           coalesce(sum(case when cost_type='fixed' then amount else 0 end),0) fixed
      from public.apiary_expenses
     where apiary_id = _apiary_id and occurred_at between _start and _end
  ), p as (
    select coalesce(sum(case when product_type='honey' then quantity_kg else 0 end),0) honey_kg,
           count(distinct hive_id) filter (where quantity_kg > 0) hives
      from public.hive_production_records
     where apiary_id = _apiary_id and produced_at between _start and _end
  )
  select _apiary_id,
         s.rev,
         e.total,
         e.fixed,
         e.total - e.fixed,
         s.rev - e.total,
         p.honey_kg,
         s.honey_sold,
         s.honey_rev,
         p.hives::integer
    from s, e, p;
$$;

grant execute on function public.apiary_economic_summary(uuid, date, date) to authenticated;
