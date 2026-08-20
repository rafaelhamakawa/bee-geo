-- GeoApis: funções administrativas seguras e papéis de usuário.
-- Execute após 20260819000000_geoapis_schema.sql.
begin;

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('user', 'admin'));
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

-- Um usuário comum pode editar apenas os campos pessoais e nunca o próprio papel.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  role text,
  created_at timestamptz,
  apiary_count bigint,
  analysis_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores'
      using errcode = '42501';
  end if;

  return query
  select
    users.id,
    users.email::text,
    profiles.full_name,
    profiles.phone,
    profiles.role,
    users.created_at,
    (select count(*) from public.apiaries where user_id = users.id),
    (select count(*) from public.analyses where user_id = users.id)
  from auth.users as users
  left join public.profiles as profiles on profiles.id = users.id
  order by users.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_update_profile(
  target_user_id uuid,
  new_full_name text,
  new_phone text,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
  admin_total bigint;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores'
      using errcode = '42501';
  end if;

  if new_role not in ('user', 'admin') then
    raise exception 'Papel de usuário inválido'
      using errcode = '22023';
  end if;

  select role
  into current_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Perfil não encontrado'
      using errcode = 'P0002';
  end if;

  if current_role = 'admin' and new_role = 'user' then
    select count(*) into admin_total
    from public.profiles
    where role = 'admin';

    if admin_total <= 1 then
      raise exception 'O sistema precisa manter pelo menos um administrador'
        using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set
    full_name = nullif(trim(new_full_name), ''),
    phone = nullif(trim(new_phone), ''),
    role = new_role,
    updated_at = now()
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text, text) from public;
grant execute on function public.admin_update_profile(uuid, text, text, text) to authenticated;

create or replace function public.admin_list_apiaries()
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  notes text,
  created_at timestamptz,
  analysis_count bigint,
  recommended_hives bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores'
      using errcode = '42501';
  end if;

  return query
  select
    apiaries.id,
    apiaries.user_id,
    users.email::text,
    apiaries.name,
    apiaries.address,
    apiaries.latitude,
    apiaries.longitude,
    apiaries.notes,
    apiaries.created_at,
    count(analyses.id),
    coalesce(sum(analyses.recommended_hives), 0)::bigint
  from public.apiaries as apiaries
  join auth.users as users on users.id = apiaries.user_id
  left join public.analyses as analyses on analyses.apiary_id = apiaries.id
  group by
    apiaries.id,
    apiaries.user_id,
    users.email,
    apiaries.name,
    apiaries.address,
    apiaries.latitude,
    apiaries.longitude,
    apiaries.notes,
    apiaries.created_at
  order by apiaries.created_at desc;
end;
$$;

revoke all on function public.admin_list_apiaries() from public;
grant execute on function public.admin_list_apiaries() to authenticated;

commit;

-- Depois que a primeira conta for cadastrada e o e-mail confirmado, promova-a
-- uma única vez pelo SQL Editor do Supabase (substitua o marcador):
--
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = '<EMAIL_DO_ADMIN>');
