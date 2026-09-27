-- TripFlow V0.4.0 - Live Trip & Realtime
-- Run after 202609270002_v030_finance_reporting_integrity.sql.
begin;

create table if not exists public.itinerary_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid not null references public.itinerary_items(id) on delete cascade,
  operation_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check(event_type in ('check_in','complete','auto_complete','skip','reset','status')),
  from_status text check(from_status is null or from_status in ('planned','active','done','skipped')),
  to_status text not null check(to_status in ('planned','active','done','skipped')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(operation_id,item_id)
);
create index if not exists itinerary_events_trip_time on public.itinerary_events(trip_id,occurred_at desc,id desc);
create index if not exists itinerary_events_item_time on public.itinerary_events(item_id,occurred_at desc,id desc);

alter table public.itinerary_events enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='itinerary_events' and policyname='member_read'
  ) then
    create policy member_read on public.itinerary_events
    for select to authenticated
    using(private.trip_role(trip_id) is not null);
  end if;
end $$;
revoke all on public.itinerary_events from anon,authenticated;
grant select on public.itinerary_events to authenticated;

-- V0.4 wraps the existing mutation engine so every successful live status change
-- creates an immutable event in the same transaction. operation_id prevents
-- duplicate history rows when offline/retry submits the same mutation again.
alter function public.tf_mutate(jsonb) rename to tf_mutate_v020;
revoke execute on function public.tf_mutate_v020(jsonb) from authenticated,anon,public;

create function public.tf_mutate(req jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  result jsonb;
  tid uuid:=nullif(req->>'tripId','')::uuid;
  rid uuid:=nullif(req->>'id','')::uuid;
  op uuid:=nullif(req->>'operationId','')::uuid;
  ent text:=req->>'entity';
  act text:=req->>'action';
  target_status text:=req->'data'->>'status';
  before_status text;
  before_active_id uuid;
  before_active_status text;
  event_name text;
  op_already_processed boolean:=false;
begin
  if ent='item' and act='status' and tid is not null and rid is not null then
    if op is not null then
      select exists(
        select 1 from private.mutation_receipts r
        where r.user_id=auth.uid() and r.operation_id=op
      ) into op_already_processed;
    end if;
    select status into before_status
    from public.itinerary_items
    where id=rid and trip_id=tid and deleted_at is null;

    select id,status into before_active_id,before_active_status
    from public.itinerary_items
    where trip_id=tid and status='active' and deleted_at is null
    limit 1;
  end if;

  result:=public.tf_mutate_v020(req);

  if ent='item' and act='status' and tid is not null and rid is not null and op is not null and not op_already_processed then
    event_name:=case target_status
      when 'active' then 'check_in'
      when 'done' then 'complete'
      when 'skipped' then 'skip'
      when 'planned' then 'reset'
      else 'status'
    end;

    insert into public.itinerary_events(
      trip_id,item_id,operation_id,actor_id,event_type,from_status,to_status,metadata
    ) values (
      tid,rid,op,auth.uid(),event_name,before_status,target_status,
      jsonb_build_object('source','tf_mutate','previous_active_id',before_active_id)
    ) on conflict(operation_id,item_id) do nothing;

    if target_status='active' and before_active_id is not null and before_active_id<>rid then
      insert into public.itinerary_events(
        trip_id,item_id,operation_id,actor_id,event_type,from_status,to_status,metadata
      ) values (
        tid,before_active_id,op,auth.uid(),'auto_complete',coalesce(before_active_status,'active'),'done',
        jsonb_build_object('source','tf_mutate','next_item_id',rid)
      ) on conflict(operation_id,item_id) do nothing;
    end if;
  end if;

  return result;
end;
$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;
grant execute on function public.tf_mutate(jsonb) to authenticated;

-- Realtime publication is enabled only when the Supabase publication exists.
-- The frontend keeps a 30-second refetch fallback, so a self-hosted PostgreSQL
-- environment without this publication still works correctly.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['trips','itinerary_items','itinerary_events','expenses'] loop
      if not exists(
        select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=t
      ) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;

commit;
