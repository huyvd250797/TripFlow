-- TripFlow V2.10.1 — run after V2.10.0. Add selected equal sharing; preserve all existing rules.
begin;
do $$begin
 if not exists(select 1 from public.tf_schema_versions where version='2.10.0') or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='budget_items' and column_name='cost_sharing') then
  raise exception 'Run 202611010003_v2100_custom_cost_sharing.sql before V2.10.1';
 end if;
end$$;
create or replace function private.tf_validate_cost_sharing(t uuid, total bigint, rule jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare x jsonb; ids uuid[]; fixed_sum numeric:=0;
begin
 if rule is null or rule='null'::jsonb then return; end if;
 if jsonb_typeof(rule)<>'object' or rule->>'mode' not in ('equal','selected_equal','fixed_remainder') or rule->>'mode' is null then raise exception 'INVALID_COST_SHARING';end if;
 if rule->>'mode'='equal' then
  if not exists(select 1 from public.trip_participants where trip_id=t and deleted_at is null) then raise exception 'COST_SHARING_NO_PARTICIPANTS';end if;
  return;
 end if;
 if rule->>'mode'='selected_equal' then
  if jsonb_typeof(rule->'participants') is distinct from 'array' then raise exception 'INVALID_COST_SHARING';end if;
  if jsonb_array_length(rule->'participants') not between 1 and 999 then raise exception 'INVALID_COST_SHARING';end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(rule->'participants');
  if cardinality(ids)<>(select count(distinct chosen.id) from unnest(ids) as chosen(id)) then raise exception 'INVALID_COST_SHARING';end if;
  if exists(select 1 from unnest(ids) as chosen(id) where chosen.id is null or not exists(select 1 from public.trip_participants p where p.id=chosen.id and p.trip_id=t and p.deleted_at is null)) then raise exception 'INVALID_PARTICIPANT';end if;
  return;
 end if;
 if jsonb_typeof(rule->'fixed') is distinct from 'array' or jsonb_typeof(rule->'participants') is distinct from 'array' then raise exception 'INVALID_COST_SHARING';end if;
 if jsonb_array_length(rule->'fixed') not between 1 and 999 or jsonb_array_length(rule->'participants') not between 1 and 999 then raise exception 'INVALID_COST_SHARING';end if;
 for x in select value from jsonb_array_elements(rule->'fixed') loop
  if (x->>'amount')::numeric<>trunc((x->>'amount')::numeric) or (x->>'amount')::numeric not between 1 and 1000000000000 or x->>'amount' is null then raise exception 'INVALID_COST_SHARING';end if;
  fixed_sum:=fixed_sum+(x->>'amount')::numeric;
 end loop;
 if fixed_sum>total then raise exception 'COST_SHARING_EXCEEDS_TOTAL';end if;
 if (select count(*)<>count(distinct value->>'participant_id') from jsonb_array_elements(rule->'fixed')) or (select count(*)<>count(distinct value) from jsonb_array_elements_text(rule->'participants')) then raise exception 'INVALID_COST_SHARING';end if;
 select array_agg(id) into ids from (
  select (value->>'participant_id')::uuid id from jsonb_array_elements(rule->'fixed')
  union all select value::uuid from jsonb_array_elements_text(rule->'participants')
 ) all_ids;
 if exists(select 1 from unnest(ids) as chosen(id) where chosen.id is null or not exists(select 1 from public.trip_participants p where p.id=chosen.id and p.trip_id=t and p.deleted_at is null)) then raise exception 'INVALID_PARTICIPANT';end if;
end;$$;
revoke all on function private.tf_validate_cost_sharing(uuid,bigint,jsonb) from public,anon,authenticated;

create or replace function private.tf_remap_cost_sharing(rule jsonb, ids jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when rule is null or rule='null'::jsonb then null when rule->>'mode'='equal' then rule
 when rule->>'mode'='selected_equal' then jsonb_build_object('mode','selected_equal','participants',coalesce((select jsonb_agg(ids->>x) from jsonb_array_elements_text(rule->'participants') x),'[]'::jsonb))
 else jsonb_build_object('mode','fixed_remainder',
 'fixed',coalesce((select jsonb_agg(x||jsonb_build_object('participant_id',ids->>(x->>'participant_id'))) from jsonb_array_elements(rule->'fixed') x),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(ids->>x) from jsonb_array_elements_text(rule->'participants') x),'[]'::jsonb)) end;
$$;
revoke all on function private.tf_remap_cost_sharing(jsonb,jsonb) from public,anon,authenticated;

do $$begin if to_regprocedure('public.tf_mutate_v2100(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v2100;end if;end$$;
revoke all on function public.tf_mutate_v2100(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(req->>'tripId')::uuid;pid uuid:=(req->>'id')::uuid;
begin
 if req->>'entity'='participant' and req->>'action'='delete' then
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
  if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
  if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
  perform pg_advisory_xact_lock(hashtextextended(t::text,1));
  if exists(select 1 from public.budget_items b where b.trip_id=t and b.deleted_at is null and b.cost_sharing->>'mode' in ('fixed_remainder','selected_equal') and
   (exists(select 1 from jsonb_array_elements_text(b.cost_sharing->'participants') v where v::uuid=pid) or exists(select 1 from jsonb_array_elements(b.cost_sharing->'fixed') f where (f->>'participant_id')::uuid=pid))) then raise exception 'PARTICIPANT_HAS_COST_SHARES';end if;
 end if;
 return public.tf_mutate_v2100(req);
end;$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;grant execute on function public.tf_mutate(jsonb) to authenticated;

insert into public.tf_schema_versions(version,migration_name) values('2.10.1','202611010004_v2101_selected_cost_sharing.sql') on conflict(version) do nothing;
create or replace function public.tf_selected_cost_sharing_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tf_schema_versions where version='2.10.1') and public.tf_cost_sharing_ready();
$$;
revoke all on function public.tf_selected_cost_sharing_ready() from public,anon;grant execute on function public.tf_selected_cost_sharing_ready() to authenticated;
do $$begin if to_regprocedure('public.tf_release_readiness_v2100()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v2100;end if;end$$;
revoke all on function public.tf_release_readiness_v2100() from public,anon,authenticated;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v2100();ok:=public.tf_selected_cost_sharing_ready();return r||jsonb_build_object('app_version','2.10.1','database_version','2.10.1','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','selected_cost_sharing','label','Selected Cost Sharing V2.10.1','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;
commit;
