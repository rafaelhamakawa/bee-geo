create table if not exists public.fipmel_cotacao_atual (
  id smallint primary key check (id = 1),
  valor_centavos integer not null check (valor_centavos > 0),
  data_referencia date not null,
  consultado_em timestamptz not null
);
grant select, insert, update on table public.fipmel_cotacao_atual to service_role;
alter table public.fipmel_cotacao_atual enable row level security;
revoke all on table public.fipmel_cotacao_atual from anon, authenticated;