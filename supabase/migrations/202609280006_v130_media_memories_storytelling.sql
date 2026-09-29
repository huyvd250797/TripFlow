-- TripFlow V1.3.0 — Media, Memories & Storytelling
-- Run after 202609280005_v100_stable_production_release.sql.
begin;

alter table public.media_links
  add column if not exists taken_on date,
  add column if not exists is_highlight boolean not null default false,
  add column if not exists is_cover boolean not null default false,
  add column if not exists story_order integer not null default 0 check(story_order between 0 and 9999);

create index if not exists media_story_order on public.media_links(trip_id,taken_on,story_order,created_at) where deleted_at is null;
create index if not exists media_highlights on public.media_links(trip_id,is_highlight) where deleted_at is null and is_highlight=true;
create unique index if not exists one_trip_cover_media on public.media_links(trip_id) where deleted_at is null and is_cover=true;

-- Extend the existing mutation chain without duplicating its authorization/idempotency logic.
alter function public.tf_mutate(jsonb) rename to tf_mutate_v120;
revoke execute on function public.tf_mutate_v120(jsonb) from authenticated,anon,public;

create function public.tf_mutate(req jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  result jsonb;
  ent text:=req->>'entity';
  act text:=req->>'action';
  tid uuid:=nullif(req->>'tripId','')::uuid;
  rid uuid:=nullif(req->>'id','')::uuid;
  d jsonb:=coalesce(req->'data','{}'::jsonb);
  cover_value boolean:=coalesce(nullif(d->>'is_cover','')::boolean,false);
begin
  result:=public.tf_mutate_v120(req);

  if ent='media' and act in ('create','update') and tid is not null and rid is not null then
    if cover_value then
      update public.media_links
      set is_cover=false,updated_at=now()
      where trip_id=tid and id<>rid and deleted_at is null and is_cover=true;
    end if;

    update public.media_links
    set taken_on=nullif(d->>'taken_on','')::date,
        is_highlight=coalesce(nullif(d->>'is_highlight','')::boolean,false),
        is_cover=cover_value,
        story_order=greatest(coalesce(nullif(d->>'story_order','')::int,0),0),
        updated_at=now()
    where id=rid and trip_id=tid and deleted_at is null;

    select to_jsonb(m) into result
    from public.media_links m
    where m.id=rid and m.trip_id=tid and m.deleted_at is null;
  end if;

  return result;
end;
$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;
grant execute on function public.tf_mutate(jsonb) to authenticated;

-- Media metadata changes should appear on other devices without waiting for fallback refetch.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='media_links'
  ) then
    alter publication supabase_realtime add table public.media_links;
  end if;
end $$;

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
    insert into public.media_links(id,trip_id,item_id,title,kind,url,note,taken_on,is_highlight,is_cover,story_order)
    values(
      gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'kind',left(r->>'url',3000),left(coalesce(r->>'note',''),5000),
      nullif(r->>'taken_on','')::date,coalesce((r->>'is_highlight')::boolean,false),coalesce((r->>'is_cover')::boolean,false),greatest(coalesce((r->>'story_order')::int,0),0)
    );
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
      is_cover=case when m.is_cover and exists(select 1 from public.media_links c where c.trip_id=target_trip and c.deleted_at is null and c.is_cover and c.id<>m.id) then false else m.is_cover end,
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

insert into public.tf_schema_versions(version,migration_name)
values ('1.3.0','202609280006_v130_media_memories_storytelling.sql')
on conflict(version) do update set migration_name=excluded.migration_name;

create or replace function public.tf_release_readiness() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  account jsonb;
  rls_ok boolean;
  stable_marker_ok boolean;
  storytelling_ok boolean;
  checks jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  account:=public.tf_account_state();
  if coalesce(account->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;

  select exists(select 1 from public.tf_schema_versions where version='1.3.0') into stable_marker_ok;
  select count(*)=4 into storytelling_ok
  from information_schema.columns
  where table_schema='public' and table_name='media_links'
    and column_name in ('taken_on','is_highlight','is_cover','story_order');

  select count(*)=16 and bool_and(c.relrowsecurity) into rls_ok
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname=any(array[
      'trips','trip_members','itinerary_items','budget_items','expenses',
      'media_links','trip_participants','trip_invitations','budget_snapshots',
      'audit_logs','tf_user_accounts','tf_admin_audit','itinerary_events',
      'trip_access_events','trip_backups','tf_schema_versions'
    ]);

  checks:=jsonb_build_array(
    jsonb_build_object('key','schema_marker','label','Schema marker V1.3.0','ok',coalesce(stable_marker_ok,false)),
    jsonb_build_object('key','storytelling','label','Media storytelling metadata V1.3','ok',coalesce(storytelling_ok,false)),
    jsonb_build_object('key','account_gate','label','Account gate V0.2','ok',to_regprocedure('public.tf_account_state()') is not null),
    jsonb_build_object('key','finance','label','Finance integrity V0.3','ok',to_regprocedure('public.tf_finance_report(uuid)') is not null),
    jsonb_build_object('key','live_trip','label','Live Trip history V0.4','ok',to_regclass('public.itinerary_events') is not null),
    jsonb_build_object('key','collaboration','label','Collaboration V0.5','ok',to_regclass('public.trip_access_events') is not null),
    jsonb_build_object('key','backup_recovery','label','Backup & Recovery V0.7','ok',to_regprocedure('public.tf_recovery_overview(uuid)') is not null and to_regclass('public.trip_backups') is not null),
    jsonb_build_object('key','idempotency','label','Mutation idempotency','ok',to_regclass('private.mutation_receipts') is not null),
    jsonb_build_object('key','single_active','label','Single active itinerary guard','ok',to_regclass('public.one_active_item') is not null),
    jsonb_build_object('key','rls','label','RLS on protected tables','ok',coalesce(rls_ok,false))
  );

  return jsonb_build_object(
    'app_version','1.3.0',
    'channel','stable',
    'database_version',case when stable_marker_ok then '1.3.0' else null end,
    'checked_at',now(),
    'account',account,
    'checks',checks,
    'ready',not exists(
      select 1 from jsonb_array_elements(checks) x
      where coalesce((x->>'ok')::boolean,false)=false
    )
  );
end;
$$;
revoke all on function public.tf_release_readiness() from public,anon;
grant execute on function public.tf_release_readiness() to authenticated;

commit;
