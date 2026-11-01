-- TripFlow V2.9.0 — run after V2.8.0. Existing expenses remain personal until explicitly classified.
begin;
alter table public.expenses add column if not exists payment_source text not null default 'personal' check(payment_source in ('personal','fund'));
create table if not exists public.trip_funds(id uuid primary key references public.trips(id),trip_id uuid unique not null references public.trips(id),keeper text not null default '',note text not null default '',version integer not null default 1);
create table if not exists public.fund_targets(id uuid primary key,trip_id uuid not null references public.trips(id),participant_id uuid not null references public.trip_participants(id),amount bigint not null check(amount>=0 and amount<=1000000000000),due_on date,version integer not null default 1,unique(trip_id,participant_id));
create table if not exists public.fund_entries(id uuid primary key,trip_id uuid not null references public.trips(id),kind text not null check(kind in ('contribution','return','reimbursement','reversal')),participant_id uuid references public.trip_participants(id),expense_id uuid references public.expenses(id),reverses_id uuid unique references public.fund_entries(id),amount bigint not null check(amount>0 and amount<=1000000000000),occurred_on date not null,note text not null default '',method text not null default '',receipt_url text not null default '',created_at timestamptz not null default now());
create index if not exists fund_entries_trip on public.fund_entries(trip_id,created_at);
create index if not exists fund_entries_expense on public.fund_entries(expense_id) where expense_id is not null;
do $$declare t text;begin foreach t in array array['trip_funds','fund_targets','fund_entries'] loop execute format('alter table public.%I enable row level security',t);execute format('drop policy if exists fund_read on public.%I',t);execute format('create policy fund_read on public.%I for select to authenticated using(private.trip_role(trip_id) is not null)',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('drop trigger if exists fund_audit on public.%I',t);execute format('create trigger fund_audit after insert or update on public.%I for each row execute function private.audit_change()',t);end loop;end$$;
create or replace function private.tf_fund_balance(t uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce((select sum(case when e.kind='contribution' then e.amount else -e.amount end) from public.fund_entries e where e.trip_id=t and e.kind<>'reversal' and not exists(select 1 from public.fund_entries r where r.reverses_id=e.id)),0)-coalesce((select sum(case when kind='refund' then -amount else amount end) from public.expenses where trip_id=t and payment_source='fund' and deleted_at is null),0);
$$;
create or replace function private.tf_fund_check(t uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.tf_fund_balance(t)<0 then raise exception 'FUND_INSUFFICIENT';end if;
 if exists(select 1 from public.expenses e where e.trip_id=t and e.kind='payment' and (
  select coalesce(sum(f.amount),0) from public.fund_entries f where f.expense_id=e.id and f.kind='reimbursement' and not exists(select 1 from public.fund_entries r where r.reverses_id=f.id)
 ) > case when e.deleted_at is not null or e.payment_source='fund' then 0 else e.amount-coalesce((select sum(x.amount) from public.expenses x where x.refund_of=e.id and x.deleted_at is null),0) end) then raise exception 'REIMBURSEMENT_EXCEEDS_ADVANCE';end if;
 if exists(select 1 from public.fund_entries f where f.trip_id=t and f.kind in ('contribution','return') group by participant_id having sum(case when exists(select 1 from public.fund_entries r where r.reverses_id=f.id) then 0 when kind='contribution' then amount else -amount end)<0) then raise exception 'RETURN_EXCEEDS_CONTRIBUTION';end if;
end;$$;
revoke all on function private.tf_fund_balance(uuid),private.tf_fund_check(uuid) from public,anon,authenticated;
do $$begin if to_regprocedure('public.tf_mutate_v280(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v280;end if;end$$;
revoke all on function public.tf_mutate_v280(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(req->>'tripId')::uuid;u uuid:=auth.uid();op uuid:=(req->>'operationId')::uuid;r jsonb;receipt private.mutation_receipts;src text;rid uuid;
begin
 if req->>'entity'<>'expense' then return public.tf_mutate_v280(req);end if;
 if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 src:=req->'data'->>'payment_source';
 if src is null and req->>'action'='update' then select payment_source into src from public.expenses where id=(req->>'id')::uuid and trip_id=t;end if;
 src:=coalesce(src,'personal');
 if req->'data'->>'kind'='refund' then select payment_source into src from public.expenses where id=(req->'data'->>'refund_of')::uuid and trip_id=t;end if;
 if src not in ('personal','fund') then raise exception 'INVALID_PAYMENT_SOURCE';end if;
 r:=public.tf_mutate_v280(req);rid:=(r->>'id')::uuid;
 if req->>'action' in ('create','update') then
  update public.expenses set payment_source=src where id=rid and trip_id=t returning to_jsonb(expenses.*) into r;
 end if;
 perform private.tf_fund_check(t);
 update private.mutation_receipts set result=r where user_id=u and operation_id=op;
 return r;
end;$$;
grant execute on function public.tf_mutate(jsonb) to authenticated;revoke all on function public.tf_mutate(jsonb) from public,anon;
create or replace function public.tf_fund_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tripId')::uuid;u uuid:=auth.uid();op uuid:=(p->>'operationId')::uuid;a text:=p->>'action';d jsonb:=p->'data';r jsonb;receipt private.mutation_receipts;pid uuid;eid uuid;rid uuid;amt bigint;old_entry public.fund_entries;v integer;
begin
 if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 if op is null then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(p::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>12000 then raise exception 'INVALID_DATA';end if;
 if a='setup' then
  select version into v from public.trip_funds where trip_id=t;
  if v is not null and v<>coalesce((p->>'version')::integer,0) then raise exception 'STALE_VERSION';end if;
  if length(coalesce(d->>'keeper',''))>160 or length(coalesce(d->>'note',''))>2000 then raise exception 'INVALID_DATA';end if;
  insert into public.trip_funds(id,trip_id,keeper,note) values(t,t,coalesce(d->>'keeper',''),coalesce(d->>'note','')) on conflict(trip_id) do update set keeper=excluded.keeper,note=excluded.note,version=trip_funds.version+1 returning to_jsonb(trip_funds.*) into r;
 elsif a='target' then
  pid:=(d->>'participant_id')::uuid;amt:=(d->>'amount')::bigint;
  if not exists(select 1 from public.trip_participants where id=pid and trip_id=t and deleted_at is null) then raise exception 'INVALID_PARTICIPANT';end if;
  select version into v from public.fund_targets where trip_id=t and participant_id=pid;
  if v is not null and v<>coalesce((p->>'version')::integer,0) then raise exception 'STALE_VERSION';end if;
  insert into public.fund_targets(id,trip_id,participant_id,amount,due_on) values(gen_random_uuid(),t,pid,amt,nullif(d->>'due_on','')::date) on conflict(trip_id,participant_id) do update set amount=excluded.amount,due_on=excluded.due_on,version=fund_targets.version+1 returning to_jsonb(fund_targets.*) into r;
 elsif a='entry' then
  if not exists(select 1 from public.trip_funds where trip_id=t) then raise exception 'FUND_SETUP_REQUIRED';end if;
  if d->>'kind' is null or d->>'kind' not in ('contribution','return','reimbursement','reversal') then raise exception 'INVALID_KIND';end if;
  pid:=nullif(d->>'participant_id','')::uuid;eid:=nullif(d->>'expense_id','')::uuid;rid:=nullif(d->>'reverses_id','')::uuid;amt:=(d->>'amount')::bigint;
  if d->>'kind'='reversal' then
   select * into old_entry from public.fund_entries where id=rid and trip_id=t and kind<>'reversal';
   if old_entry.id is null then raise exception 'INVALID_REVERSAL';end if;
   pid:=old_entry.participant_id;eid:=old_entry.expense_id;amt:=old_entry.amount;
  else
   rid:=null;
   if d->>'kind' in ('contribution','return') and not exists(select 1 from public.trip_participants where id=pid and trip_id=t and deleted_at is null) then raise exception 'INVALID_PARTICIPANT';end if;
   if d->>'kind'='reimbursement' and not exists(select 1 from public.expenses where id=eid and trip_id=t and kind='payment' and payment_source='personal' and deleted_at is null) then raise exception 'INVALID_ADVANCE';end if;
   if d->>'kind'='reimbursement' then pid:=null;else eid:=null;end if;
  end if;
  if length(coalesce(d->>'receipt_url',''))>2000 or (coalesce(d->>'receipt_url','')<>'' and d->>'receipt_url' !~ '^https://[^[:space:]]+$') or length(coalesce(d->>'note',''))>2000 or length(coalesce(d->>'method',''))>100 then raise exception 'INVALID_DATA';end if;
  insert into public.fund_entries(id,trip_id,kind,participant_id,expense_id,reverses_id,amount,occurred_on,note,method,receipt_url) values(gen_random_uuid(),t,d->>'kind',pid,eid,rid,amt,(d->>'occurred_on')::date,coalesce(d->>'note',''),coalesce(d->>'method',''),coalesce(d->>'receipt_url','')) returning to_jsonb(fund_entries.*) into r;
  perform private.tf_fund_check(t);
 else raise exception 'INVALID_ACTION';end if;
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,t,md5(p::text),r);return r;
end;$$;
revoke all on function public.tf_fund_mutate(jsonb) from public,anon;grant execute on function public.tf_fund_mutate(jsonb) to authenticated;
do $$begin if to_regprocedure('public.tf_release_readiness_v280()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v280;end if;end$$;
revoke all on function public.tf_release_readiness_v280() from public,anon,authenticated;
insert into public.tf_schema_versions(version,migration_name) values('2.9.0','202611010002_v290_trip_fund.sql') on conflict(version) do nothing;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v280();select count(*)=3 and bool_and(relrowsecurity) into ok from pg_class where oid in (to_regclass('public.trip_funds'),to_regclass('public.fund_targets'),to_regclass('public.fund_entries'));return r||jsonb_build_object('app_version','2.9.0','database_version','2.9.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','trip_fund','label','Trip Fund V2.9.0','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;

-- Full cashbook preserved by application backup / restore-as-copy. Legacy backups remain compatible.

-- Recovery must obey the same cash invariant as ordinary expense writes.
do $$begin if to_regprocedure('public.tf_restore_deleted_v280(uuid,text,uuid)') is null then alter function public.tf_restore_deleted(uuid,text,uuid) rename to tf_restore_deleted_v280;end if;end$$;
revoke all on function public.tf_restore_deleted_v280(uuid,text,uuid) from public,anon,authenticated;
create or replace function public.tf_restore_deleted(target_trip uuid,target_entity text,target_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(target_trip::text,1));
 r:=public.tf_restore_deleted_v280(target_trip,target_entity,target_id);
 if target_entity='expense' then perform private.tf_fund_check(target_trip);end if;
 return r;
end;$$;
revoke all on function public.tf_restore_deleted(uuid,text,uuid) from public,anon;grant execute on function public.tf_restore_deleted(uuid,text,uuid) to authenticated;
create or replace function public.tf_create_trip_backup(target_trip uuid, backup_title text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  tr public.trips;
  p jsonb;
  b public.trip_backups;
  keep_days integer;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_trip::text,1));
  select * into tr from public.trips where id=target_trip and deleted_at is null;
  if tr.id is null then raise exception 'NOT_FOUND'; end if;
  if tr.owner_id<>u then raise exception 'OWNER_ONLY'; end if;
  select backup_days into keep_days from public.tf_retention_policy where id=1;

  p:=jsonb_build_object(
    'format','tripflow-recovery-backup',
    'format_version',1,
    'created_at',now(),
    'source_trip_id',target_trip,
    'trip',to_jsonb(tr),
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at,x.id) from public.itinerary_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.budget_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'fund', (select to_jsonb(f) from public.trip_funds f where f.trip_id=target_trip),
    'fund_targets',coalesce((select jsonb_agg(to_jsonb(f)) from public.fund_targets f where f.trip_id=target_trip),'[]'::jsonb),
    'fund_entries',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at,f.id) from public.fund_entries f where f.trip_id=target_trip),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.spent_on,x.created_at,x.id) from public.expenses x where x.trip_id=target_trip),'[]'::jsonb),
    'media',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.media_links x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_participants x where x.trip_id=target_trip),'[]'::jsonb),
    'snapshots',coalesce((select jsonb_agg(jsonb_build_object('title',x.title,'data',x.data,'created_at',x.created_at) order by x.created_at,x.id) from public.budget_snapshots x where x.trip_id=target_trip),'[]'::jsonb),
    'live_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at,x.id) from public.itinerary_events x where x.trip_id=target_trip),'[]'::jsonb),
    'audit_archive',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (select * from public.audit_logs where trip_id=target_trip order by created_at desc limit 1000) x),'[]'::jsonb)
  );

  insert into public.trip_backups(source_trip_id,owner_id,title,payload,checksum,size_bytes,expires_at)
  values(
    target_trip,u,
    coalesce(nullif(btrim(backup_title),''),tr.name||' · Backup '||to_char(now(),'DD/MM/YYYY HH24:MI')),
    p,md5(p::text),octet_length(p::text),now()+make_interval(days=>keep_days)
  ) returning * into b;

  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(target_trip,u,'trip_backups',b.id,'BACKUP_CREATE',jsonb_build_object('title',b.title,'checksum',b.checksum,'size_bytes',b.size_bytes,'expires_at',b.expires_at));

  return jsonb_build_object('id',b.id,'source_trip_id',b.source_trip_id,'title',b.title,'checksum',b.checksum,'size_bytes',b.size_bytes,'created_at',b.created_at,'expires_at',b.expires_at);
end;
$$;

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

  for r in select value from jsonb_array_elements(coalesce(p->'budgets','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); budget_map:=budget_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.budget_items(id,trip_id,item_id,title,category,quantity,unit_price,note)
    values(new_id,new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'category',(r->>'quantity')::numeric,(r->>'unit_price')::bigint,left(coalesce(r->>'note',''),5000));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='payment' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at)
    values(new_id,new_trip,nullif(mapped,'')::uuid,null,'payment',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='refund' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at)
    values(new_id,new_trip,nullif(mapped,'')::uuid,nullif(expense_map->>(r->>'refund_of'),'')::uuid,'refund',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz);
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'media','[]'::jsonb)) loop
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.media_links(id,trip_id,item_id,title,kind,url,note,taken_on,is_highlight,is_cover,story_order)
    values(
      gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'kind',left(r->>'url',3000),left(coalesce(r->>'note',''),5000),
      nullif(r->>'taken_on','')::date,coalesce((r->>'is_highlight')::boolean,false),coalesce((r->>'is_cover')::boolean,false),greatest(coalesce((r->>'story_order')::int,0),0)
    );
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    new_id:=gen_random_uuid();participant_map:=participant_map||jsonb_build_object(r->>'id',new_id::text);
    insert into public.trip_participants(id,trip_id,name,note,deleted_at)
    values(new_id,new_trip,left(r->>'name',160),left(coalesce(r->>'note',''),5000),nullif(r->>'deleted_at','')::timestamptz);
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
