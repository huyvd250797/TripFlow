-- TripFlow V1.4.0 — Smart Planning Templates & Reuse
-- Run after 202609280006_v130_media_memories_storytelling.sql.
begin;

-- End date/time are intentionally optional from V1.4.0 onward.
alter table public.trips alter column end_date drop not null;
alter table public.trips drop constraint if exists trips_check;
alter table public.trips drop constraint if exists trips_date_range_check;
alter table public.trips
  add constraint trips_date_range_check
  check (end_date is null or (end_date >= start_date and end_date - start_date <= 730));

alter table public.itinerary_items alter column end_at drop not null;
alter table public.itinerary_items drop constraint if exists itinerary_items_check;
alter table public.itinerary_items drop constraint if exists itinerary_end_after_start_check;
alter table public.itinerary_items
  add constraint itinerary_end_after_start_check
  check (end_at is null or end_at > start_at);

create table if not exists public.trip_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(btrim(name)) between 1 and 160),
  description text not null default '' check(length(description) <= 1200),
  destination text not null default '' check(length(destination) <= 300),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  people integer not null default 1 check(people between 1 and 999),
  duration_days integer check(duration_days is null or duration_days between 0 and 730),
  item_count integer not null default 0 check(item_count >= 0),
  budget_count integer not null default 0 check(budget_count >= 0),
  participant_count integer not null default 0 check(participant_count >= 0),
  payload jsonb not null default '{}'::jsonb,
  usage_count integer not null default 0 check(usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_templates_owner_updated on public.trip_templates(owner_id,updated_at desc);

alter table public.trip_templates enable row level security;
drop policy if exists template_owner_select on public.trip_templates;
create policy template_owner_select on public.trip_templates
  for select to authenticated using (owner_id=auth.uid());
drop policy if exists template_owner_insert on public.trip_templates;
create policy template_owner_insert on public.trip_templates
  for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists template_owner_update on public.trip_templates;
create policy template_owner_update on public.trip_templates
  for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists template_owner_delete on public.trip_templates;
create policy template_owner_delete on public.trip_templates
  for delete to authenticated using (owner_id=auth.uid());
grant select,insert,update,delete on public.trip_templates to authenticated;

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

insert into public.tf_schema_versions(version,migration_name)
values ('1.4.0','202609290001_v140_smart_planning_templates_reuse.sql')
on conflict(version) do update set migration_name=excluded.migration_name;

create or replace function public.tf_release_readiness() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  account jsonb;
  rls_ok boolean;
  stable_marker_ok boolean;
  storytelling_ok boolean;
  templates_ok boolean;
  optional_end_ok boolean;
  checks jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  account:=public.tf_account_state();
  if coalesce(account->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;

  select exists(select 1 from public.tf_schema_versions where version='1.4.0') into stable_marker_ok;
  select count(*)=4 into storytelling_ok
  from information_schema.columns
  where table_schema='public' and table_name='media_links'
    and column_name in ('taken_on','is_highlight','is_cover','story_order');
  select to_regclass('public.trip_templates') is not null
    and to_regprocedure('public.tf_save_trip_template(uuid,text,text)') is not null
    and to_regprocedure('public.tf_create_trip_from_template(uuid,text,date,text)') is not null
  into templates_ok;
  select
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='trips' and column_name='end_date' and is_nullable='YES')
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='itinerary_items' and column_name='end_at' and is_nullable='YES')
  into optional_end_ok;

  select count(*)=17 and bool_and(c.relrowsecurity) into rls_ok
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname=any(array[
      'trips','trip_members','itinerary_items','budget_items','expenses',
      'media_links','trip_participants','trip_invitations','budget_snapshots',
      'audit_logs','tf_user_accounts','tf_admin_audit','itinerary_events',
      'trip_access_events','trip_backups','tf_schema_versions','trip_templates'
    ]);

  checks:=jsonb_build_array(
    jsonb_build_object('key','schema_marker','label','Schema marker V1.4.0','ok',coalesce(stable_marker_ok,false)),
    jsonb_build_object('key','planning_templates','label','Planning Templates & Reuse V1.4','ok',coalesce(templates_ok,false)),
    jsonb_build_object('key','optional_end','label','Optional end date/time V1.4','ok',coalesce(optional_end_ok,false)),
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
    'app_version','1.4.0',
    'channel','stable',
    'database_version',case when stable_marker_ok then '1.4.0' else null end,
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
