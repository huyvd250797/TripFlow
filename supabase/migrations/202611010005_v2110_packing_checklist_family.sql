-- TripFlow V2.11.0 — Packing, Checklist & Family Travel
-- Upgrade only: run once after all V2.10.1 migrations. No reset, no data deletion.
begin;
do $$begin
 if not exists(select 1 from public.tf_schema_versions where version='2.10.1') then raise exception 'Run V2.10.1 migrations first';end if;
end$$;
alter table public.trip_participants add column if not exists age_group text not null default 'adult' check(age_group in ('adult','child','infant'));
alter table public.trip_participants add column if not exists family_group text not null default '' check(length(family_group)<=160);
alter table public.trip_participants add column if not exists needs_note text not null default '' check(length(needs_note)<=5000);
create table if not exists public.trip_checklist_items (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),
 category text not null check(category in ('Giấy tờ','Hành lý','Đồ điện tử','Thuốc & vật dụng cá nhân','Đồ cho bé','Việc trước khi đi')),
 kind text not null check(kind in ('packing','task')), scope text not null check(scope in ('shared','personal')),
 assignee_id uuid references public.trip_participants(id), quantity integer not null default 1 check(quantity between 1 and 999),
 due_on date, note text not null default '' check(length(note)<=5000),
 status text not null default 'needed' check(status in ('needed','ready','packed','done')), excluded boolean not null default false,
 version integer not null default 1, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(scope<>'personal' or assignee_id is not null), check((kind='task' and status in ('needed','done')) or (kind='packing' and status in ('needed','ready','packed')))
);
create index if not exists checklist_trip_order on public.trip_checklist_items(trip_id,category,created_at,id) where deleted_at is null;
create table if not exists public.trip_contacts (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 200), kind text not null check(kind in ('hotel','driver','family','other')),
 phone text not null default '' check(length(phone)<=40 and phone ~ '^[+0-9 ().-]*$'), address text not null default '' check(length(address)<=500),
 map_url text not null default '' check(length(map_url)<=3000 and (map_url='' or map_url ~ '^https://[^[:space:]]+$')),
 note text not null default '' check(length(note)<=5000), version integer not null default 1, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists contacts_trip_order on public.trip_contacts(trip_id,created_at,id) where deleted_at is null;
alter table public.trip_checklist_items enable row level security;
alter table public.trip_contacts enable row level security;
drop policy if exists checklist_read on public.trip_checklist_items;
create policy checklist_read on public.trip_checklist_items for select to authenticated using(private.trip_role(trip_id) is not null);
drop policy if exists contacts_read on public.trip_contacts;
create policy contacts_read on public.trip_contacts for select to authenticated using(private.trip_role(trip_id) is not null);
revoke all on public.trip_checklist_items,public.trip_contacts from public,anon,authenticated;
grant select on public.trip_checklist_items,public.trip_contacts to authenticated;

-- Internal writer: only the authenticated, locked, receipted wrapper may call it.
create or replace function private.tf_preparation_write(t uuid, ent text, act text, rid uuid, expected integer, d jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tbl text; before_row jsonb; result jsonb; pid uuid;
begin
 if ent is null or act is null or ent not in ('checklist','contact') or act not in ('create','update','delete') or rid is null then raise exception 'INVALID_PREPARATION';end if;
 tbl:=case ent when 'checklist' then 'trip_checklist_items' else 'trip_contacts' end;
 if act<>'create' then
  execute format('select to_jsonb(x) from public.%I x where id=$1 and trip_id=$2 and deleted_at is null for update',tbl) into before_row using rid,t;
  if before_row is null then raise exception 'NOT_FOUND';end if;
  if expected is null or expected<>(before_row->>'version')::integer then raise exception 'CONFLICT';end if;
 end if;
 if act='delete' then
  execute format('update public.%I set deleted_at=now(),version=version+1,updated_at=now() where id=$1 and trip_id=$2 returning to_jsonb(%I.*)',tbl,tbl) into result using rid,t;
 elsif ent='checklist' then
  pid:=nullif(d->>'assignee_id','')::uuid;
  if pid is not null and not exists(select 1 from public.trip_participants where id=pid and trip_id=t and deleted_at is null) then raise exception 'INVALID_PARTICIPANT';end if;
  if act='create' then
   insert into public.trip_checklist_items(id,trip_id,title,category,kind,scope,assignee_id,quantity,due_on,note,status,excluded)
   values(rid,t,btrim(d->>'title'),d->>'category',d->>'kind',d->>'scope',pid,(d->>'quantity')::int,nullif(d->>'due_on','')::date,coalesce(d->>'note',''),d->>'status',coalesce((d->>'excluded')::boolean,false)) returning to_jsonb(trip_checklist_items.*) into result;
  else
   update public.trip_checklist_items set title=btrim(d->>'title'),category=d->>'category',kind=d->>'kind',scope=d->>'scope',assignee_id=pid,quantity=(d->>'quantity')::int,due_on=nullif(d->>'due_on','')::date,note=coalesce(d->>'note',''),status=d->>'status',excluded=coalesce((d->>'excluded')::boolean,false),version=version+1,updated_at=now() where id=rid and trip_id=t returning to_jsonb(trip_checklist_items.*) into result;
  end if;
 else
  if act='create' then
   insert into public.trip_contacts(id,trip_id,name,kind,phone,address,map_url,note) values(rid,t,btrim(d->>'name'),d->>'kind',coalesce(d->>'phone',''),coalesce(d->>'address',''),coalesce(d->>'map_url',''),coalesce(d->>'note','')) returning to_jsonb(trip_contacts.*) into result;
  else
   update public.trip_contacts set name=btrim(d->>'name'),kind=d->>'kind',phone=coalesce(d->>'phone',''),address=coalesce(d->>'address',''),map_url=coalesce(d->>'map_url',''),note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=rid and trip_id=t returning to_jsonb(trip_contacts.*) into result;
  end if;
 end if;
 insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,before_data,after_data) values(t,auth.uid(),tbl,rid,upper(act),before_row,result);
 return result;
end;$$;
revoke all on function private.tf_preparation_write(uuid,text,text,uuid,integer,jsonb) from public,anon,authenticated;
do $$begin if to_regprocedure('public.tf_mutate_v2101(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v2101;end if;end$$;
revoke all on function public.tf_mutate_v2101(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();t uuid:=(req->>'tripId')::uuid;op uuid:=(req->>'operationId')::uuid;ent text:=req->>'entity';act text:=req->>'action';d jsonb:=req->'data';r jsonb;x jsonb;receipt private.mutation_receipts;rid uuid:=(req->>'id')::uuid; results jsonb:='[]'::jsonb;
begin
 if ent not in ('checklist','checklist_batch','contact','participant') then return public.tf_mutate_v2101(req);end if;
 if u is null or op is null then raise exception 'UNAUTHORIZED';end if;
 if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
 if private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 if ent='participant' then
  if act='delete' and exists(select 1 from public.trip_checklist_items where trip_id=t and assignee_id=rid and deleted_at is null) then raise exception 'PARTICIPANT_HAS_CHECKLIST';end if;
  r:=public.tf_mutate_v2101(req);rid:=(r->>'id')::uuid;
  if act in ('create','update') then
   update public.trip_participants set age_group=coalesce(d->>'age_group',age_group),family_group=coalesce(d->>'family_group',family_group),needs_note=coalesce(d->>'needs_note',needs_note) where id=rid and trip_id=t returning to_jsonb(trip_participants.*) into r;
   update private.mutation_receipts set result=r where user_id=u and operation_id=op;
   update public.audit_logs set after_data=r where record_id=rid and actor_id=u and created_at=now();
  end if;
  return r;
 elsif ent='checklist_batch' then
  if act<>'create' or jsonb_typeof(d->'entries') is distinct from 'array' then raise exception 'INVALID_PREPARATION';end if;
  if jsonb_array_length(d->'entries') not between 1 and 60 then raise exception 'INVALID_PREPARATION';end if;
  for x in select value from jsonb_array_elements(d->'entries') loop
   results:=results||jsonb_build_array(private.tf_preparation_write(t,'checklist','create',(x->>'id')::uuid,null,x));
  end loop;
  r:=jsonb_build_object('entries',results);
 else
  r:=private.tf_preparation_write(t,ent,act,rid,(req->>'version')::integer,d);
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

insert into public.tf_schema_versions(version,migration_name) values('2.11.0','202611010005_v2110_packing_checklist_family.sql') on conflict(version) do nothing;
create or replace function public.tf_preparation_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tf_schema_versions where version='2.11.0') and
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='trip_checklist_items' and c.relrowsecurity) and
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='trip_contacts' and c.relrowsecurity);
$$;
revoke all on function public.tf_preparation_ready() from public,anon;grant execute on function public.tf_preparation_ready() to authenticated;
do $$begin if to_regprocedure('public.tf_release_readiness_v2101()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v2101;end if;end$$;
revoke all on function public.tf_release_readiness_v2101() from public,anon,authenticated;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v2101();ok:=public.tf_preparation_ready();return r||jsonb_build_object('app_version','2.11.0','database_version','2.11.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','preparation','label','Packing, Checklist & Family Travel V2.11.0','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;
do $$declare tbl text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach tbl in array array['trip_checklist_items','trip_contacts'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then execute format('alter publication supabase_realtime add table public.%I',tbl);end if;
  end loop;
 end if;
end$$;
commit;
