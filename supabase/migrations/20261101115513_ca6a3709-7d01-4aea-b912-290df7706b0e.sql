CREATE OR REPLACE FUNCTION public.sync_hive_last_management()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  target uuid := coalesce(new.hive_id, old.hive_id);
begin
  -- Ao excluir em cascata (apiário/colmeia), a colmeia também está sendo removida: não atualizar.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return null;
  end if;
  update public.hives h
     set last_management_at = (select max(m.managed_at) from public.hive_managements m where m.hive_id = target),
         updated_at = now()
   where h.id = target;
  return null;
end;
$function$;