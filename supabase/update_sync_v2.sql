-- =====================================================================
--  Update — atomic quantity changes (run once in Supabase → SQL Editor)
-- ---------------------------------------------------------------------
--  Stock / comptoir / production quantities are now sent by the app as
--  increments (+/-) applied atomically by the database, so two devices
--  selling or producing at the same time never overwrite each other.
--  (Also included in schema.sql — running either file is enough.)
-- =====================================================================
create or replace function public.apply_counter_deltas(p_table text, p_id text, p_deltas jsonb)
returns jsonb
language plpgsql
security invoker            -- Row Level Security still applies
set search_path = public
as $$
declare
  allowed text[];
  k       text;
  d       numeric;
  sets    text := '';
  result  jsonb;
begin
  allowed := case p_table
    when 'products'       then array['current_quantity', 'principal_quantity']
    when 'comptoir_items' then array['quantity']
    when 'productions'    then array['sent_to_comptoir']
    else null
  end;
  if allowed is null then
    raise exception 'table_not_allowed: %', p_table;
  end if;
  for k in select jsonb_object_keys(coalesce(p_deltas, '{}'::jsonb)) loop
    if not (k = any (allowed)) then
      raise exception 'column_not_allowed: %', k;
    end if;
    d := (p_deltas ->> k)::numeric;      -- cast guarantees a plain number
    if d is null or d = 0 then continue; end if;
    sets := sets || case when sets = '' then '' else ', ' end
         || format('%I = greatest(0, coalesce(%I, 0) + (%s)::numeric)', k, k, d::text);
  end loop;
  if sets = '' then
    return null;
  end if;
  execute format('update public.%I set %s where id = $1 returning to_jsonb(%I.*)', p_table, sets, p_table)
    into result using p_id;
  return result;
end;
$$;

revoke all on function public.apply_counter_deltas(text, text, jsonb) from public, anon;
grant execute on function public.apply_counter_deltas(text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
