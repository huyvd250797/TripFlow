-- TripFlow V2.12.0 — Flexible Itinerary & Route Planning
-- Upgrade from V2.11.0 only. Run once before deploying V2.12.0. No reset.
begin;
do $$begin if not exists(select 1 from public.tf_schema_versions where version='2.11.0') then raise exception 'Run V2.11.0 migrations first';end if;end$$;
alter table public.itinerary_items add column if not exists time_mode text not null default 'flexible' check(time_mode in ('flexible','fixed'));
alter table public.itinerary_items add column if not exists earliest_at timestamptz;
alter table public.itinerary_items add column if not exists latest_at timestamptz;
alter table public.itinerary_items add column if not exists travel_mode text not null default 'other' check(travel_mode in ('walk','motorbike','car','taxi','transit','other'));
alter table public.itinerary_items add column if not exists travel_minutes integer check(travel_minutes between 0 and 2880);
alter table public.itinerary_items add column if not exists buffer_minutes integer not null default 0 check(buffer_minutes between 0 and 1440);
alter table public.itinerary_items add column if not exists leg_from_id uuid references public.itinerary_items(id);
create table if not exists public.trip_wishes (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200), location text not null default '' check(length(location)<=300),
 duration_minutes integer not null check(duration_minutes between 5 and 2880),
 map_url text not null default '' check(length(map_url)<=3000 and (map_url='' or map_url ~ '^https://[^[:space:]]+$')),
 note text not null default '' check(length(note)<=5000), backup_for_id uuid references public.itinerary_items(id),
 version integer not null default 1, deleted_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists wishes_trip_order on public.trip_wishes(trip_id,created_at,id) where deleted_at is null;
alter table public.trip_wishes enable row level security;
drop policy if exists wishes_read on public.trip_wishes;
create policy wishes_read on public.trip_wishes for select to authenticated using(private.trip_role(trip_id) is not null);
revoke all on public.trip_wishes from public,anon,authenticated;grant select on public.trip_wishes to authenticated;
create or replace function private.tf_wish_write(t uuid,act text,rid uuid,expected integer,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.trip_wishes;r jsonb;ref uuid:=nullif(d->>'backup_for_id','')::uuid;
begin
 if act is null or act not in ('create','update','delete') or rid is null then raise exception 'INVALID_ROUTE';end if;
 if act<>'create' then select * into old from public.trip_wishes where id=rid and trip_id=t and deleted_at is null for update;if old.id is null then raise exception 'NOT_FOUND';end if;if expected is null or expected<>old.version then raise exception 'CONFLICT';end if;end if;
 if act<>'delete' and ref is not null and not exists(select 1 from public.itinerary_items where id=ref and trip_id=t and deleted_at is null and status='planned') then raise exception 'INVALID_LINK';end if;
 if act='delete' then update public.trip_wishes set deleted_at=now(),version=version+1,updated_at=now() where id=rid and trip_id=t returning to_jsonb(trip_wishes.*) into r;
 elsif act='create' then insert into public.trip_wishes(id,trip_id,title,location,duration_minutes,map_url,note,backup_for_id) values(rid,t,btrim(d->>'title'),coalesce(d->>'location',''),(d->>'duration_minutes')::integer,coalesce(d->>'map_url',''),coalesce(d->>'note',''),ref) returning to_jsonb(trip_wishes.*) into r;
 else update public.trip_wishes set title=btrim(d->>'title'),location=coalesce(d->>'location',''),duration_minutes=(d->>'duration_minutes')::integer,map_url=coalesce(d->>'map_url',''),note=coalesce(d->>'note',''),backup_for_id=ref,version=version+1,updated_at=now() where id=rid and trip_id=t returning to_jsonb(trip_wishes.*) into r;end if;
 insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,before_data,after_data) values(t,auth.uid(),'trip_wishes',rid,upper(act),case when old.id is not null then to_jsonb(old) else null end,r);
 return r;
end;$$;
revoke all on function private.tf_wish_write(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
do $$begin if to_regprocedure('public.tf_mutate_v2110(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v2110;end if;end$$;
revoke all on function public.tf_mutate_v2110(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t uuid:=(req->>'tripId')::uuid;op uuid:=(req->>'operationId')::uuid;ent text:=req->>'entity';act text:=req->>'action';d jsonb:=req->'data';rid uuid:=(req->>'id')::uuid;r jsonb;x jsonb;y jsonb;old public.itinerary_items;receipt private.mutation_receipts;current_context jsonb;expected_context jsonb;rows jsonb:='[]'::jsonb;ref uuid;
begin
 if ent not in ('item','wish','route_batch') then return public.tf_mutate_v2110(req);end if;
 if u is null or op is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
 if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 if ent='item' then
  r:=public.tf_mutate_v2110(req);rid:=(r->>'id')::uuid;
  if act in ('create','update') then
   ref:=case when d ? 'leg_from_id' then nullif(d->>'leg_from_id','')::uuid else (r->>'leg_from_id')::uuid end;
   if ref=rid or ref is not null and not exists(select 1 from public.itinerary_items where id=ref and trip_id=t and deleted_at is null) then raise exception 'INVALID_LINK';end if;
   update public.itinerary_items set
    time_mode=coalesce(d->>'time_mode',time_mode),earliest_at=case when d ? 'earliest_at' then nullif(d->>'earliest_at','')::timestamptz else earliest_at end,
    latest_at=case when d ? 'latest_at' then nullif(d->>'latest_at','')::timestamptz else latest_at end,
    travel_mode=coalesce(d->>'travel_mode',travel_mode),travel_minutes=case when d ? 'travel_minutes' then (d->>'travel_minutes')::integer else travel_minutes end,
    buffer_minutes=coalesce((d->>'buffer_minutes')::integer,buffer_minutes),leg_from_id=ref
    where id=rid and trip_id=t returning to_jsonb(itinerary_items.*) into r;
   if r->>'earliest_at' is not null and (r->>'start_at')::timestamptz<(r->>'earliest_at')::timestamptz or
      r->>'latest_at' is not null and (r->>'end_at' is null or (r->>'end_at')::timestamptz>(r->>'latest_at')::timestamptz) or
      r->>'earliest_at' is not null and r->>'latest_at' is not null and (r->>'earliest_at')::timestamptz>(r->>'latest_at')::timestamptz then raise exception 'TIME_BOUND_VIOLATION';end if;
   update private.mutation_receipts set result=r where user_id=u and operation_id=op;
  elsif act='delete' then
   update public.trip_wishes set backup_for_id=null,version=version+1,updated_at=now() where trip_id=t and backup_for_id=rid and deleted_at is null;
  end if;
  return r;
 elsif ent='wish' then r:=private.tf_wish_write(t,act,rid,(req->>'version')::integer,d);
 else
  if d->>'trip_version' is null or (d->>'trip_version')::integer<>(select version from public.trips where id=t) then raise exception 'ROUTE_CONTEXT_CHANGED';end if;
  if act<>'create' or jsonb_typeof(d->'context') is distinct from 'array' or jsonb_typeof(d->'updates') is distinct from 'array' then raise exception 'INVALID_ROUTE';end if;
  if jsonb_array_length(d->'context')>200 or jsonb_array_length(d->'updates')>100 or jsonb_array_length(d->'updates')=0 and not (d ? 'create_item') then raise exception 'INVALID_ROUTE';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version) order by id),'[]'::jsonb) into current_context from public.itinerary_items where trip_id=t and deleted_at is null and status<>'skipped';
  select coalesce(jsonb_agg(jsonb_build_object('id',(value->>'id')::uuid,'version',(value->>'version')::integer) order by (value->>'id')::uuid),'[]'::jsonb) into expected_context from jsonb_array_elements(d->'context');
  if expected_context<>current_context then raise exception 'ROUTE_CONTEXT_CHANGED';end if;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(d->'updates')) then raise exception 'INVALID_ROUTE';end if;
  -- Validate every affected record before writing anything. Nested mutations remain one transaction.
  for x in select value from jsonb_array_elements(d->'updates') loop
   select * into old from public.itinerary_items where id=(x->>'id')::uuid and trip_id=t and deleted_at is null and status='planned';
   if old.id is null or old.version<>(x->>'version')::integer then raise exception 'CONFLICT';end if;
  end loop;
  if d ? 'replace_item' then
   x:=d->'replace_item';select * into old from public.itinerary_items where id=(x->>'id')::uuid and trip_id=t and deleted_at is null and status='planned';
   if old.id is null or old.version<>(x->>'version')::integer or not (d ? 'create_item') or exists(select 1 from jsonb_array_elements(d->'updates') v where v->>'id'=x->>'id') then raise exception 'CONFLICT';end if;
   if (x->>'keep_old')::boolean then perform private.tf_wish_write(t,'create',(x->>'wish_id')::uuid,null,jsonb_build_object('title',old.title,'location',old.location,'duration_minutes',case when old.end_at is null then 60 else greatest(5,least(2880,ceil(extract(epoch from old.end_at-old.start_at)/60)::integer)) end,'map_url',old.map_url,'note',old.note,'backup_for_id',null));end if;
   y:=public.tf_mutate(jsonb_build_object('operationId',gen_random_uuid(),'tripId',t,'entity','item','action','status','id',old.id,'version',old.version,'data',jsonb_build_object('status','skipped')));rows:=rows||jsonb_build_array(y);
  end if;
  for x in select value from jsonb_array_elements(d->'updates') loop
   select * into old from public.itinerary_items where id=(x->>'id')::uuid and trip_id=t;
   y:=public.tf_mutate(jsonb_build_object('operationId',gen_random_uuid(),'tripId',t,'entity','item','action','update','id',old.id,'version',old.version,'data',to_jsonb(old)||jsonb_build_object('start_at',x->'start_at','end_at',x->'end_at')));rows:=rows||jsonb_build_array(y);
  end loop;
  if d ? 'create_item' then
   x:=d->'create_item';y:=public.tf_mutate(jsonb_build_object('operationId',gen_random_uuid(),'tripId',t,'entity','item','action','create','id',x->>'id','data',x->'data'));rows:=rows||jsonb_build_array(y);
  end if;
  if d ? 'consume_wish' then x:=d->'consume_wish';perform private.tf_wish_write(t,'delete',(x->>'id')::uuid,(x->>'version')::integer,'{}'::jsonb);end if;
  r:=jsonb_build_object('items',rows);
 end if;
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,t,md5(req::text),r);
 return r;
end;$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;grant execute on function public.tf_mutate(jsonb) to authenticated;

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
    'wishes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_wishes x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_checklist_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'contacts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_contacts x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
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

  -- Restore metadata only after every itinerary ID has been mapped.
  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    update public.itinerary_items set time_mode=coalesce(r->>'time_mode','flexible'),earliest_at=(r->>'earliest_at')::timestamptz,latest_at=(r->>'latest_at')::timestamptz,
      travel_mode=coalesce(r->>'travel_mode','other'),travel_minutes=(r->>'travel_minutes')::integer,buffer_minutes=coalesce((r->>'buffer_minutes')::integer,0),leg_from_id=(item_map->>(r->>'leg_from_id'))::uuid
    where id=(item_map->>(r->>'id'))::uuid and trip_id=new_trip;
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'wishes','[]'::jsonb)) loop
    -- Restored trip may retain completed/skipped history referenced by a saved Plan B.
    insert into public.trip_wishes(id,trip_id,title,location,duration_minutes,map_url,note,backup_for_id)
    values(gen_random_uuid(),new_trip,r->>'title',coalesce(r->>'location',''),(r->>'duration_minutes')::integer,coalesce(r->>'map_url',''),coalesce(r->>'note',''),(item_map->>(r->>'backup_for_id'))::uuid);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    new_id:=gen_random_uuid();participant_map:=participant_map||jsonb_build_object(r->>'id',new_id::text);
    insert into public.trip_participants(id,trip_id,name,note,deleted_at,age_group,family_group,needs_note)
    values(new_id,new_trip,left(r->>'name',160),left(coalesce(r->>'note',''),5000),nullif(r->>'deleted_at','')::timestamptz,coalesce(r->>'age_group','adult'),coalesce(r->>'family_group',''),coalesce(r->>'needs_note',''));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'checklist','[]'::jsonb)) loop
    perform private.tf_preparation_write(new_trip,'checklist','create',gen_random_uuid(),null,r||jsonb_build_object('assignee_id',participant_map->>(r->>'assignee_id')));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'contacts','[]'::jsonb)) loop
    perform private.tf_preparation_write(new_trip,'contact','create',gen_random_uuid(),null,r);
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


-- Planning templates retain wall-clock constraints and remap route legs.
create or replace function public.tf_save_trip_template(
  target_trip uuid,
  template_name text,
  template_description text default ''
) returns public.trip_templates
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  tr public.trips;
  role_name text;
  result public.trip_templates;
  p jsonb;
  duration integer;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  role_name:=private.trip_role(target_trip);
  if role_name is null then raise exception 'FORBIDDEN'; end if;
  if role_name='viewer' then raise exception 'READ_ONLY'; end if;
  if length(btrim(coalesce(template_name,''))) not between 1 and 160 then raise exception 'INVALID_TEMPLATE_NAME'; end if;

  select * into tr from public.trips where id=target_trip and deleted_at is null;
  if tr.id is null then raise exception 'NOT_FOUND'; end if;
  duration:=case when tr.end_date is null then null else tr.end_date-tr.start_date end;

  p:=jsonb_build_object(
    'format','tripflow-planning-template',
    'format_version',1,
    'source_trip_id',tr.id,
    'saved_at',now(),
    'trip',jsonb_build_object(
      'destination',tr.destination,'timezone',tr.timezone,'people',tr.people,
      'duration_days',duration,'note',tr.note
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'title',i.title,'location',i.location,'map_url',i.map_url,'note',i.note,
        'time_mode',i.time_mode,'travel_mode',i.travel_mode,'travel_minutes',i.travel_minutes,'buffer_minutes',i.buffer_minutes,'leg_from_id',i.leg_from_id,
        'earliest_offset_minutes',case when i.earliest_at is null then null else round(extract(epoch from ((i.earliest_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int end,
        'latest_offset_minutes',case when i.latest_at is null then null else round(extract(epoch from ((i.latest_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int end,
        'start_offset_minutes',round(extract(epoch from ((i.start_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int,
        'end_offset_minutes',case when i.end_at is null then null else round(extract(epoch from ((i.end_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int end
      ) order by i.start_at)
      from public.itinerary_items i where i.trip_id=tr.id and i.deleted_at is null
    ),'[]'::jsonb),
    'budgets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'item_id',b.item_id,'title',b.title,'category',b.category,
        'quantity',b.quantity,'unit_price',b.unit_price,'note',b.note
      ) order by b.created_at)
      from public.budget_items b where b.trip_id=tr.id and b.deleted_at is null
    ),'[]'::jsonb),
    'participants',coalesce((
      select jsonb_agg(jsonb_build_object('name',p.name,'note',p.note) order by p.created_at)
      from public.trip_participants p where p.trip_id=tr.id and p.deleted_at is null
    ),'[]'::jsonb)
  );

  insert into public.trip_templates(
    owner_id,name,description,destination,timezone,people,duration_days,
    item_count,budget_count,participant_count,payload
  ) values(
    u,btrim(template_name),left(coalesce(template_description,''),1200),tr.destination,tr.timezone,tr.people,duration,
    jsonb_array_length(p->'items'),jsonb_array_length(p->'budgets'),jsonb_array_length(p->'participants'),p
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.tf_save_trip_template(uuid,text,text) from public,anon;
grant execute on function public.tf_save_trip_template(uuid,text,text) to authenticated;

create or replace function public.tf_create_trip_from_template(
  template_id uuid,
  new_name text,
  new_start_date date,
  new_destination text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  tpl public.trip_templates;
  p jsonb;
  t jsonb;
  r jsonb;
  new_trip uuid:=gen_random_uuid();
  new_id uuid;
  old_id text;
  old_ref text;
  mapped text;
  item_map jsonb:='{}'::jsonb;
  zone_name text;
  duration integer;
  start_offset integer;
  end_offset integer;
  start_time timestamptz;
  end_time timestamptz;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  if new_start_date is null then raise exception 'START_DATE_REQUIRED'; end if;
  if length(btrim(coalesce(new_name,''))) not between 1 and 160 then raise exception 'INVALID_TRIP_NAME'; end if;

  select * into tpl from public.trip_templates where id=template_id and owner_id=u for update;
  if tpl.id is null then raise exception 'NOT_FOUND'; end if;
  p:=tpl.payload; t:=p->'trip';
  if p->>'format'<>'tripflow-planning-template' or coalesce((p->>'format_version')::int,0)<>1 then raise exception 'TEMPLATE_FORMAT_UNSUPPORTED'; end if;
  zone_name:=coalesce(nullif(t->>'timezone',''),tpl.timezone,'Asia/Ho_Chi_Minh');
  if not exists(select 1 from pg_timezone_names where name=zone_name) then raise exception 'INVALID_TIMEZONE'; end if;
  duration:=coalesce((t->>'duration_days')::int,tpl.duration_days);

  insert into public.trips(id,owner_id,name,destination,start_date,end_date,timezone,people,status,note)
  values(
    new_trip,u,btrim(new_name),left(coalesce(new_destination,t->>'destination',tpl.destination,''),300),
    new_start_date,case when duration is null then null else new_start_date+duration end,zone_name,
    greatest(1,least(999,coalesce((t->>'people')::int,tpl.people,1))),'planning',left(coalesce(t->>'note',''),5000)
  );

  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); item_map:=item_map||jsonb_build_object(old_id,new_id::text);
    start_offset:=coalesce((r->>'start_offset_minutes')::int,0);
    end_offset:=nullif(r->>'end_offset_minutes','')::int;
    start_time:=(new_start_date::timestamp + make_interval(mins=>start_offset)) at time zone zone_name;
    end_time:=case when end_offset is null then null else (new_start_date::timestamp + make_interval(mins=>end_offset)) at time zone zone_name end;
    insert into public.itinerary_items(id,trip_id,title,location,start_at,end_at,status,map_url,note)
    values(
      new_id,new_trip,left(coalesce(r->>'title','Hoạt động'),200),left(coalesce(r->>'location',''),300),
      start_time,end_time,'planned',left(coalesce(r->>'map_url',''),3000),left(coalesce(r->>'note',''),5000)
    );
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    update public.itinerary_items set time_mode=coalesce(r->>'time_mode','flexible'),travel_mode=coalesce(r->>'travel_mode','other'),travel_minutes=(r->>'travel_minutes')::integer,buffer_minutes=coalesce((r->>'buffer_minutes')::integer,0),leg_from_id=(item_map->>(r->>'leg_from_id'))::uuid,
      earliest_at=case when r->>'earliest_offset_minutes' is null then null else (new_start_date::timestamp+make_interval(mins=>(r->>'earliest_offset_minutes')::int)) at time zone zone_name end,
      latest_at=case when r->>'latest_offset_minutes' is null then null else (new_start_date::timestamp+make_interval(mins=>(r->>'latest_offset_minutes')::int)) at time zone zone_name end
    where id=(item_map->>(r->>'id'))::uuid and trip_id=new_trip;
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'budgets','[]'::jsonb)) loop
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.budget_items(id,trip_id,item_id,title,category,quantity,unit_price,note)
    values(
      gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(coalesce(r->>'title','Dự toán'),200),r->>'category',
      (r->>'quantity')::numeric,(r->>'unit_price')::bigint,left(coalesce(r->>'note',''),5000)
    );
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    insert into public.trip_participants(id,trip_id,name,note)
    values(gen_random_uuid(),new_trip,left(coalesce(r->>'name','Người tham gia'),160),left(coalesce(r->>'note',''),5000));
  end loop;

  update public.trip_templates set usage_count=usage_count+1,last_used_at=now(),updated_at=now() where id=tpl.id;
  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(new_trip,u,'trip_templates',tpl.id,'APPLY_TEMPLATE',jsonb_build_object('template_name',tpl.name,'source_trip_id',p->>'source_trip_id'));
  return jsonb_build_object('trip_id',new_trip,'name',new_name,'template_id',tpl.id);
end;
$$;
revoke all on function public.tf_create_trip_from_template(uuid,text,date,text) from public,anon;
grant execute on function public.tf_create_trip_from_template(uuid,text,date,text) to authenticated;


insert into public.tf_schema_versions(version,migration_name) values('2.12.0','202611010006_v2120_flexible_itinerary.sql') on conflict(version) do nothing;
create or replace function public.tf_flexible_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tf_schema_versions where version='2.12.0') and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='trip_wishes' and c.relrowsecurity) and exists(select 1 from information_schema.columns where table_schema='public' and table_name='itinerary_items' and column_name='leg_from_id');
$$;
revoke all on function public.tf_flexible_ready() from public,anon;grant execute on function public.tf_flexible_ready() to authenticated;
do $$begin if to_regprocedure('public.tf_release_readiness_v2110()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v2110;end if;end$$;
revoke all on function public.tf_release_readiness_v2110() from public,anon,authenticated;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v2110();ok:=public.tf_flexible_ready();return r||jsonb_build_object('app_version','2.12.0','database_version','2.12.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','flexible_planning','label','Flexible Itinerary V2.12.0','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trip_wishes') then alter publication supabase_realtime add table public.trip_wishes;end if;end$$;
commit;
