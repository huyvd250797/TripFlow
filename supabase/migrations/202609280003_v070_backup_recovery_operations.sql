-- TripFlow V0.7.0 - Backup, Recovery & Operations
-- Run after V0.5.0 migrations. V0.6.0 has no schema changes.
begin;

create table if not exists public.tf_retention_policy (
  id smallint primary key default 1 check(id=1),
  recovery_days integer not null default 30 check(recovery_days between 1 and 3650),
  backup_days integer not null default 90 check(backup_days between 1 and 3650),
  receipt_days integer not null default 30 check(receipt_days between 1 and 3650),
  audit_days integer not null default 365 check(audit_days between 1 and 3650),
  updated_at timestamptz not null default now()
);
insert into public.tf_retention_policy(id) values(1) on conflict(id) do nothing;

create table if not exists public.trip_backups (
  id uuid primary key default gen_random_uuid(),
  source_trip_id uuid,
  owner_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 200),
  format_version integer not null default 1 check(format_version=1),
  payload jsonb not null,
  checksum text not null,
  size_bytes integer not null check(size_bytes>=0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists trip_backups_owner_time on public.trip_backups(owner_id,created_at desc);
create index if not exists trip_backups_source_time on public.trip_backups(source_trip_id,created_at desc);

alter table public.trip_backups enable row level security;
drop policy if exists trip_backup_owner_read on public.trip_backups;
create policy trip_backup_owner_read on public.trip_backups
for select to authenticated
using(owner_id=auth.uid() and coalesce(public.tf_account_state()->>'status','active')='active');
revoke all on public.trip_backups from anon,authenticated;
grant select on public.trip_backups to authenticated;

create or replace function private.tf_backup_immutable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'BACKUP_IMMUTABLE';
end;
$$;
revoke all on function private.tf_backup_immutable() from public;
drop trigger if exists tf_backup_immutable on public.trip_backups;
create trigger tf_backup_immutable before update or delete on public.trip_backups
for each row execute function private.tf_backup_immutable();

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
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.spent_on,x.created_at,x.id) from public.expenses x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'media',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.media_links x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_participants x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
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

create or replace function public.tf_get_trip_backup(backup_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.trip_backups;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into b from public.trip_backups where id=backup_id and owner_id=auth.uid();
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object(
    'id',b.id,'source_trip_id',b.source_trip_id,'title',b.title,'format_version',b.format_version,
    'checksum',b.checksum,'size_bytes',b.size_bytes,'created_at',b.created_at,'expires_at',b.expires_at,
    'payload',b.payload
  );
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
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url)
    values(new_id,new_trip,nullif(mapped,'')::uuid,null,'payment',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='refund' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url)
    values(new_id,new_trip,nullif(mapped,'')::uuid,nullif(expense_map->>(r->>'refund_of'),'')::uuid,'refund',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'media','[]'::jsonb)) loop
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.media_links(id,trip_id,item_id,title,kind,url,note)
    values(gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'kind',left(r->>'url',3000),left(coalesce(r->>'note',''),5000));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    insert into public.trip_participants(id,trip_id,name,note)
    values(gen_random_uuid(),new_trip,left(r->>'name',160),left(coalesce(r->>'note',''),5000));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'snapshots','[]'::jsonb)) loop
    insert into public.budget_snapshots(trip_id,title,data,created_by)
    values(new_trip,left(coalesce(r->>'title','Dự toán khôi phục'),200),coalesce(r->'data','[]'::jsonb),u);
  end loop;

  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(new_trip,u,'trip_backups',backup_id,'RESTORE_AS_COPY',jsonb_build_object('source_trip_id',b.source_trip_id,'checksum',b.checksum));

  return jsonb_build_object('trip_id',new_trip,'backup_id',b.id,'name',(select name from public.trips where id=new_trip));
end;
$$;

create or replace function public.tf_restore_deleted(target_trip uuid, target_entity text, target_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  tr public.trips;
  result jsonb;
  st text;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;

  if target_entity='trip' then
    select * into tr from public.trips where id=target_id and owner_id=u and deleted_at is not null for update;
    if tr.id is null then raise exception 'NOT_FOUND'; end if;
    update public.trips set deleted_at=null,version=version+1,updated_at=now() where id=target_id returning to_jsonb(trips.*) into result;
    return result;
  end if;

  select * into tr from public.trips where id=target_trip and deleted_at is null for update;
  if tr.id is null then raise exception 'NOT_FOUND'; end if;
  if tr.owner_id<>u then raise exception 'OWNER_ONLY'; end if;

  if target_entity='item' then
    select status into st from public.itinerary_items where id=target_id and trip_id=target_trip and deleted_at is not null;
    if st is null then raise exception 'NOT_FOUND'; end if;
    update public.itinerary_items
      set deleted_at=null,
          status=case when status='active' and exists(select 1 from public.itinerary_items x where x.trip_id=target_trip and x.status='active' and x.deleted_at is null) then 'planned' else status end,
          checked_in_at=case when status='active' and exists(select 1 from public.itinerary_items x where x.trip_id=target_trip and x.status='active' and x.deleted_at is null) then null else checked_in_at end,
          version=version+1,updated_at=now()
    where id=target_id and trip_id=target_trip and deleted_at is not null returning to_jsonb(itinerary_items.*) into result;
  elsif target_entity='budget' then
    update public.budget_items b set deleted_at=null,
      item_id=case when b.item_id is not null and not exists(select 1 from public.itinerary_items i where i.id=b.item_id and i.trip_id=target_trip and i.deleted_at is null) then null else b.item_id end,
      version=b.version+1,updated_at=now()
    where b.id=target_id and b.trip_id=target_trip and b.deleted_at is not null returning to_jsonb(b.*) into result;
  elsif target_entity='expense' then
    if exists(select 1 from public.expenses e where e.id=target_id and e.trip_id=target_trip and e.deleted_at is not null and e.kind='refund' and not exists(select 1 from public.expenses p where p.id=e.refund_of and p.trip_id=target_trip and p.deleted_at is null and p.kind='payment')) then
      raise exception 'DEPENDENCY_DELETED';
    end if;
    update public.expenses e set deleted_at=null,
      budget_id=case when e.budget_id is not null and not exists(select 1 from public.budget_items b where b.id=e.budget_id and b.trip_id=target_trip and b.deleted_at is null) then null else e.budget_id end,
      version=e.version+1,updated_at=now()
    where e.id=target_id and e.trip_id=target_trip and e.deleted_at is not null returning to_jsonb(e.*) into result;
  elsif target_entity='media' then
    update public.media_links m set deleted_at=null,
      item_id=case when m.item_id is not null and not exists(select 1 from public.itinerary_items i where i.id=m.item_id and i.trip_id=target_trip and i.deleted_at is null) then null else m.item_id end,
      version=m.version+1,updated_at=now()
    where m.id=target_id and m.trip_id=target_trip and m.deleted_at is not null returning to_jsonb(m.*) into result;
  elsif target_entity='participant' then
    update public.trip_participants p set deleted_at=null,version=p.version+1,updated_at=now()
    where p.id=target_id and p.trip_id=target_trip and p.deleted_at is not null returning to_jsonb(p.*) into result;
  else
    raise exception 'INVALID_ENTITY';
  end if;
  if result is null then raise exception 'NOT_FOUND'; end if;
  return result;
end;
$$;

create or replace function public.tf_recovery_overview(target_trip uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  keep public.tf_retention_policy;
  deleted_trips jsonb;
  backups jsonb:='[]'::jsonb;
  tombstones jsonb:='[]'::jsonb;
  health jsonb;
  last_backup timestamptz;
  tombstone_count integer:=0;
  eligible_count integer:=0;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into keep from public.tf_retention_policy where id=1;

  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'destination',t.destination,'deleted_at',t.deleted_at,'purge_after',t.deleted_at+make_interval(days=>keep.recovery_days)) order by t.deleted_at desc),'[]'::jsonb)
  into deleted_trips from public.trips t where t.owner_id=u and t.deleted_at is not null;

  if target_trip is not null then
    if not exists(select 1 from public.trips t where t.id=target_trip and t.owner_id=u and t.deleted_at is null) then raise exception 'OWNER_ONLY'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'source_trip_id',b.source_trip_id,'title',b.title,'checksum',b.checksum,'size_bytes',b.size_bytes,'created_at',b.created_at,'expires_at',b.expires_at) order by b.created_at desc),'[]'::jsonb), max(b.created_at)
    into backups,last_backup from public.trip_backups b where b.owner_id=u and b.source_trip_id=target_trip;

    with deleted_rows as (
      select 'item'::text entity,id,title,deleted_at from public.itinerary_items where trip_id=target_trip and deleted_at is not null
      union all select 'budget',id,title,deleted_at from public.budget_items where trip_id=target_trip and deleted_at is not null
      union all select 'expense',id,title,deleted_at from public.expenses where trip_id=target_trip and deleted_at is not null
      union all select 'media',id,title,deleted_at from public.media_links where trip_id=target_trip and deleted_at is not null
      union all select 'participant',id,name,deleted_at from public.trip_participants where trip_id=target_trip and deleted_at is not null
    )
    select coalesce(jsonb_agg(jsonb_build_object('entity',entity,'id',id,'title',title,'deleted_at',deleted_at,'purge_after',deleted_at+make_interval(days=>keep.recovery_days)) order by deleted_at desc),'[]'::jsonb),count(*)::int,count(*) filter(where deleted_at+make_interval(days=>keep.recovery_days)<=now())::int
    into tombstones,tombstone_count,eligible_count from deleted_rows;
  end if;

  health:=jsonb_build_object(
    'last_backup_at',last_backup,
    'backup_count',case when target_trip is null then (select count(*) from public.trip_backups b where b.owner_id=u) else jsonb_array_length(backups) end,
    'tombstone_count',tombstone_count,
    'eligible_for_purge',eligible_count,
    'audit_count',case when target_trip is null then 0 else (select count(*) from public.audit_logs a where a.trip_id=target_trip) end,
    'receipt_count',(select count(*) from private.mutation_receipts r where r.user_id=u),
    'note','Retention chỉ đánh dấu thời hạn khôi phục. V0.7.0 không tự xóa vĩnh viễn dữ liệu production.'
  );

  return jsonb_build_object(
    'policy',jsonb_build_object('recovery_days',keep.recovery_days,'backup_days',keep.backup_days,'receipt_days',keep.receipt_days,'audit_days',keep.audit_days),
    'deleted_trips',deleted_trips,
    'backups',backups,
    'tombstones',tombstones,
    'health',health
  );
end;
$$;

create or replace function public.tf_admin_ops_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  keep public.tf_retention_policy;
  tombstones bigint;
  eligible bigint;
begin
  if not private.tf_is_master(auth.uid()) then raise exception 'MASTER_ONLY'; end if;
  select * into keep from public.tf_retention_policy where id=1;
  select count(*) into tombstones from (
    select deleted_at from public.trips where deleted_at is not null
    union all select deleted_at from public.itinerary_items where deleted_at is not null
    union all select deleted_at from public.budget_items where deleted_at is not null
    union all select deleted_at from public.expenses where deleted_at is not null
    union all select deleted_at from public.media_links where deleted_at is not null
    union all select deleted_at from public.trip_participants where deleted_at is not null
  ) d;
  select count(*) into eligible from (
    select deleted_at from public.trips where deleted_at is not null
    union all select deleted_at from public.itinerary_items where deleted_at is not null
    union all select deleted_at from public.budget_items where deleted_at is not null
    union all select deleted_at from public.expenses where deleted_at is not null
    union all select deleted_at from public.media_links where deleted_at is not null
    union all select deleted_at from public.trip_participants where deleted_at is not null
  ) d where d.deleted_at+make_interval(days=>keep.recovery_days)<=now();
  return jsonb_build_object(
    'active_trips',(select count(*) from public.trips where deleted_at is null),
    'deleted_trips',(select count(*) from public.trips where deleted_at is not null),
    'backups',(select count(*) from public.trip_backups),
    'backups_past_retention',(select count(*) from public.trip_backups where expires_at<=now()),
    'tombstones',tombstones,
    'eligible_for_purge',eligible,
    'audit_logs',(select count(*) from public.audit_logs),
    'mutation_receipts',(select count(*) from private.mutation_receipts),
    'last_backup_at',(select max(created_at) from public.trip_backups),
    'policy',jsonb_build_object('recovery_days',keep.recovery_days,'backup_days',keep.backup_days,'receipt_days',keep.receipt_days,'audit_days',keep.audit_days)
  );
end;
$$;

revoke all on function public.tf_create_trip_backup(uuid,text), public.tf_get_trip_backup(uuid), public.tf_restore_trip_backup(uuid,text), public.tf_restore_deleted(uuid,text,uuid), public.tf_recovery_overview(uuid), public.tf_admin_ops_health() from public,anon;
grant execute on function public.tf_create_trip_backup(uuid,text), public.tf_get_trip_backup(uuid), public.tf_restore_trip_backup(uuid,text), public.tf_restore_deleted(uuid,text,uuid), public.tf_recovery_overview(uuid), public.tf_admin_ops_health() to authenticated;

commit;
