-- TripFlow V2.10.0 — run once after V2.9.0. No reset; legacy allocations stay unconfigured.
begin;
alter table public.budget_items add column if not exists cost_sharing jsonb;
alter table public.expenses add column if not exists payer_participant_id uuid references public.trip_participants(id);
alter table public.expenses add column if not exists settlement_type text not null default 'advance' check(settlement_type in ('advance','direct'));

create or replace function private.tf_validate_cost_sharing(t uuid, total bigint, rule jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare x jsonb; ids uuid[]; fixed_sum numeric:=0;
begin
 if rule is null or rule='null'::jsonb then return; end if;
 if jsonb_typeof(rule)<>'object' or rule->>'mode' not in ('equal','fixed_remainder') or rule->>'mode' is null then raise exception 'INVALID_COST_SHARING';end if;
 if rule->>'mode'='equal' then
  if not exists(select 1 from public.trip_participants where trip_id=t and deleted_at is null) then raise exception 'COST_SHARING_NO_PARTICIPANTS';end if;
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

do $$begin if to_regprocedure('public.tf_mutate_v294(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v294;end if;end$$;
revoke all on function public.tf_mutate_v294(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(req->>'tripId')::uuid;u uuid:=auth.uid();op uuid:=(req->>'operationId')::uuid;r jsonb;receipt private.mutation_receipts;rid uuid;rule jsonb;pid uuid;typ text;parent public.expenses;
begin
 if req->>'entity' not in ('budget','expense','participant') then return public.tf_mutate_v294(req);end if;
 if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
 if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 if req->>'entity'='participant' and req->>'action'='delete' and exists(
  select 1 from public.budget_items b where b.trip_id=t and b.deleted_at is null and b.cost_sharing->>'mode'='fixed_remainder' and
   (exists(select 1 from jsonb_array_elements(b.cost_sharing->'fixed') f where f->>'participant_id'=req->>'id') or b.cost_sharing->'participants' ? (req->>'id'))
 ) then raise exception 'PARTICIPANT_HAS_COST_SHARES';end if;
 if req->>'entity'='budget' and req->>'action' in ('create','update') then
  if req->'data' ? 'cost_sharing' then rule:=nullif(req->'data'->'cost_sharing','null'::jsonb);
  elsif req->>'action'='update' then select cost_sharing into rule from public.budget_items where id=(req->>'id')::uuid and trip_id=t;end if;
  perform private.tf_validate_cost_sharing(t,round((req->'data'->>'quantity')::numeric*(req->'data'->>'unit_price')::numeric)::bigint,rule);
 end if;
 r:=public.tf_mutate_v294(req);rid:=(r->>'id')::uuid;
 if req->>'entity'='budget' and req->>'action' in ('create','update') then
  update public.budget_items set cost_sharing=rule where id=rid and trip_id=t returning to_jsonb(budget_items.*) into r;
 elsif req->>'entity'='expense' and req->>'action' in ('create','update') then
  typ:=coalesce(req->'data'->>'settlement_type',r->>'settlement_type','advance');
  pid:=nullif(req->'data'->>'payer_participant_id','')::uuid;
  if not (req->'data' ? 'payer_participant_id') then pid:=nullif(r->>'payer_participant_id','')::uuid;end if;
  if r->>'kind'='refund' then
   select * into parent from public.expenses where id=(r->>'refund_of')::uuid and trip_id=t;
   pid:=parent.payer_participant_id;typ:=parent.settlement_type;
  end if;
  if r->>'payment_source'='fund' then pid:=null;typ:='direct';end if;
  if typ not in ('advance','direct') then raise exception 'INVALID_PAYMENT_SOURCE';end if;
  if pid is not null and not exists(select 1 from public.trip_participants where id=pid and trip_id=t and deleted_at is null) then raise exception 'INVALID_PARTICIPANT';end if;
  update public.expenses set settlement_type=typ,payer_participant_id=pid,
   payer=case when payment_source='fund' then '' when pid is not null then (select name from public.trip_participants where id=pid) else payer end
   where id=rid and trip_id=t returning to_jsonb(expenses.*) into r;
  perform private.tf_fund_check(t);
 end if;
 update private.mutation_receipts set result=r where user_id=u and operation_id=op;
 update public.audit_logs set after_data=r where record_id=rid and actor_id=u and created_at=now();
 return r;
end;$$;
grant execute on function public.tf_mutate(jsonb) to authenticated;revoke all on function public.tf_mutate(jsonb) from public,anon;

-- Direct payments are the person's agreed share, not an advance payable by the fund.
create or replace function private.tf_fund_check(t uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.tf_fund_balance(t)<0 then raise exception 'FUND_INSUFFICIENT';end if;
 if exists(select 1 from public.expenses e where e.trip_id=t and e.kind='payment' and (
  select coalesce(sum(f.amount),0) from public.fund_entries f where f.expense_id=e.id and f.kind='reimbursement' and not exists(select 1 from public.fund_entries r where r.reverses_id=f.id)
 ) > case when e.deleted_at is not null or e.payment_source='fund' or e.settlement_type='direct' then 0 else e.amount-coalesce((select sum(x.amount) from public.expenses x where x.refund_of=e.id and x.deleted_at is null),0) end) then raise exception 'REIMBURSEMENT_EXCEEDS_ADVANCE';end if;
 if exists(select 1 from public.fund_entries f where f.trip_id=t and f.kind in ('contribution','return') group by participant_id having sum(case when exists(select 1 from public.fund_entries r where r.reverses_id=f.id) then 0 when kind='contribution' then amount else -amount end)<0) then raise exception 'RETURN_EXCEEDS_CONTRIBUTION';end if;
end;$$;

create or replace function public.tf_cost_sharing_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tf_schema_versions where version='2.10.0') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='budget_items' and column_name='cost_sharing');
$$;
revoke all on function public.tf_cost_sharing_ready() from public,anon;grant execute on function public.tf_cost_sharing_ready() to authenticated;
insert into public.tf_schema_versions(version,migration_name) values('2.10.0','202611010003_v2100_custom_cost_sharing.sql') on conflict(version) do nothing;
do $$begin if to_regprocedure('public.tf_release_readiness_v290()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v290;end if;end$$;
revoke all on function public.tf_release_readiness_v290() from public,anon,authenticated;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v290();ok:=public.tf_cost_sharing_ready();return r||jsonb_build_object('app_version','2.10.0','database_version','2.10.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','custom_cost_sharing','label','Custom Cost Sharing V2.10.0','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;

create or replace function private.tf_remap_cost_sharing(rule jsonb, ids jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when rule is null or rule='null'::jsonb then null when rule->>'mode'='equal' then rule else jsonb_build_object('mode','fixed_remainder',
 'fixed',coalesce((select jsonb_agg(x||jsonb_build_object('participant_id',ids->>(x->>'participant_id'))) from jsonb_array_elements(rule->'fixed') x),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(ids->>x) from jsonb_array_elements_text(rule->'participants') x),'[]'::jsonb)) end;
$$;
revoke all on function private.tf_remap_cost_sharing(jsonb,jsonb) from public,anon,authenticated;

-- Preserve allocations and payer identities when restoring a backup as a new trip.
create or replace function public.tf_restore_trip_backup(backup_id uuid, restored_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  b public.trip_backups;
  p jsonb;
  t jsonb;
  r jsonb;
  new_trip uuid:=gen_random_uuid();
  new_id uuid;
  item_map jsonb:='{}'::jsonb;
  budget_map jsonb:='{}'::jsonb;
  expense_map jsonb:='{}'::jsonb;
  participant_map jsonb:='{}'::jsonb;
  fund_map jsonb:='{}'::jsonb;
  old_id text;
  old_ref text;
  mapped text;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into b from public.trip_backups where id=backup_id and owner_id=u;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  p:=b.payload; t:=p->'trip';
  if p->>'format' <> 'tripflow-recovery-backup' or coalesce((p->>'format_version')::int,0)<>1 then raise exception 'BACKUP_FORMAT_UNSUPPORTED'; end if;
  if md5(p::text)<>b.checksum then raise exception 'BACKUP_CHECKSUM_MISMATCH'; end if;

  insert into public.trips(id,owner_id,name,destination,start_date,end_date,timezone,people,status,note)
  values(
    new_trip,u,
    left(coalesce(nullif(btrim(restored_name),''),coalesce(t->>'name','Chuyến đi')||' (Khôi phục)'),160),
    left(coalesce(t->>'destination',''),300),
    (t->>'start_date')::date,(t->>'end_date')::date,coalesce(t->>'timezone','Asia/Ho_Chi_Minh'),
    greatest(1,least(999,coalesce((t->>'people')::int,1))),'planning',left(coalesce(t->>'note',''),5000)
  );

  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); item_map:=item_map||jsonb_build_object(old_id,new_id::text);
    insert into public.itinerary_items(id,trip_id,title,location,start_at,end_at,status,map_url,note,checked_in_at,completed_at)
    values(new_id,new_trip,left(r->>'title',200),left(coalesce(r->>'location',''),300),(r->>'start_at')::timestamptz,(r->>'end_at')::timestamptz,
      case when r->>'status' in ('planned','active','done','skipped') then r->>'status' else 'planned' end,
      left(coalesce(r->>'map_url',''),3000),left(coalesce(r->>'note',''),5000),nullif(r->>'checked_in_at','')::timestamptz,nullif(r->>'completed_at','')::timestamptz);
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    new_id:=gen_random_uuid();participant_map:=participant_map||jsonb_build_object(r->>'id',new_id::text);
    insert into public.trip_participants(id,trip_id,name,note,deleted_at)
    values(new_id,new_trip,left(r->>'name',160),left(coalesce(r->>'note',''),5000),nullif(r->>'deleted_at','')::timestamptz);
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'budgets','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); budget_map:=budget_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.budget_items(id,trip_id,item_id,title,category,quantity,unit_price,note,cost_sharing)
    values(new_id,new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'category',(r->>'quantity')::numeric,(r->>'unit_price')::bigint,left(coalesce(r->>'note',''),5000),private.tf_remap_cost_sharing(r->'cost_sharing',participant_map));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='payment' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at,payer_participant_id,settlement_type)
    values(new_id,new_trip,nullif(mapped,'')::uuid,null,'payment',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz,(participant_map->>(r->>'payer_participant_id'))::uuid,coalesce(r->>'settlement_type','advance'));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='refund' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at,payer_participant_id,settlement_type)
    values(new_id,new_trip,nullif(mapped,'')::uuid,nullif(expense_map->>(r->>'refund_of'),'')::uuid,'refund',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz,(participant_map->>(r->>'payer_participant_id'))::uuid,coalesce(r->>'settlement_type','advance'));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'media','[]'::jsonb)) loop
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.media_links(id,trip_id,item_id,title,kind,url,note,taken_on,is_highlight,is_cover,story_order)
    values(
      gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'kind',left(r->>'url',3000),left(coalesce(r->>'note',''),5000),
      nullif(r->>'taken_on','')::date,coalesce((r->>'is_highlight')::boolean,false),coalesce((r->>'is_cover')::boolean,false),greatest(coalesce((r->>'story_order')::int,0),0)
    );
  end loop;



  if jsonb_typeof(p->'fund')='object' then
    insert into public.trip_funds(id,trip_id,keeper,note) values(new_trip,new_trip,p->'fund'->>'keeper',coalesce(p->'fund'->>'note',''));
  end if;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_targets','[]'::jsonb)) loop
    insert into public.fund_targets(id,trip_id,participant_id,amount,due_on) values(gen_random_uuid(),new_trip,(participant_map->>(r->>'participant_id'))::uuid,(r->>'amount')::bigint,nullif(r->>'due_on','')::date);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_entries','[]'::jsonb)) loop
    fund_map:=fund_map||jsonb_build_object(r->>'id',gen_random_uuid()::text);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_entries','[]'::jsonb)) order by (value->>'kind'='reversal') loop
    insert into public.fund_entries(id,trip_id,kind,participant_id,expense_id,reverses_id,amount,occurred_on,note,method,receipt_url,created_at)
    values((fund_map->>(r->>'id'))::uuid,new_trip,r->>'kind',(participant_map->>(r->>'participant_id'))::uuid,(expense_map->>(r->>'expense_id'))::uuid,(fund_map->>(r->>'reverses_id'))::uuid,(r->>'amount')::bigint,(r->>'occurred_on')::date,coalesce(r->>'note',''),coalesce(r->>'method',''),coalesce(r->>'receipt_url',''),(r->>'created_at')::timestamptz);
  end loop;
  perform private.tf_fund_check(new_trip);

  for r in select value from jsonb_array_elements(coalesce(p->'snapshots','[]'::jsonb)) loop
    insert into public.budget_snapshots(trip_id,title,data,created_by)
    values(new_trip,left(coalesce(r->>'title','Dự toán khôi phục'),200),coalesce(r->'data','[]'::jsonb),u);
  end loop;

  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(new_trip,u,'trip_backups',backup_id,'RESTORE_AS_COPY',jsonb_build_object('source_trip_id',b.source_trip_id,'checksum',b.checksum));

  return jsonb_build_object('trip_id',new_trip,'backup_id',b.id,'name',(select name from public.trips where id=new_trip));
end;
$$;
commit;
