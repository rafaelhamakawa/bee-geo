-- 004_admin.sql — acesso do administrador ao painel do app
-- Rode este script no SQL Editor do Supabase.

-- Administrador pode ver todos os perfis
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Administrador pode ver todos os apiários
drop policy if exists "apiaries_select_admin" on public.apiaries;
create policy "apiaries_select_admin" on public.apiaries for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Administrador pode ver todas as análises de pasto
drop policy if exists "forage_analyses_select_admin" on public.forage_analyses;
create policy "forage_analyses_select_admin" on public.forage_analyses for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

-- Papéis: administrador vê e gerencia todos; usuário vê apenas o próprio
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "user_roles_admin_insert" on public.user_roles;
create policy "user_roles_admin_insert" on public.user_roles for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "user_roles_admin_update" on public.user_roles;
create policy "user_roles_admin_update" on public.user_roles for update to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "user_roles_admin_delete" on public.user_roles;
create policy "user_roles_admin_delete" on public.user_roles for delete to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select, insert, update, delete on public.user_roles to authenticated;

-- Torne o e-mail abaixo administrador (ajuste se necessário)
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users where email = 'rafaelvianna@hydrazoo.com'
on conflict (user_id, role) do nothing;
