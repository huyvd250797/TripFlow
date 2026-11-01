-- TripFlow V2.8.0: run after 202610310001_v241_travel_reliability_permissions.sql.
begin;
create table if not exists public.travel_bookings (
 id uuid primary key, trip_id uuid not null references public.trips(id) on delete cascade,
 kind text not null check(kind in ('flight','transport','hotel','rental','tour','ticket','document')),
 title text not null check(length(trim(title)) between 1 and 160),
 status text not null check(status in ('pending','confirmed','used','cancelled')),
 item_id uuid references public.itinerary_items(id), budget_id uuid references public.budget_items(id),
 booking_id uuid references public.travel_bookings(id), payload jsonb not null default '{}',
 version integer not null default 1, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists travel_bookings_trip on public.travel_bookings(trip_id,created_at);
alter table public.travel_bookings enable row level security;
drop policy if exists bookings_read on public.travel_bookings;
create policy bookings_read on public.travel_bookings for select to authenticated using (private.trip_role(trip_id) is not null);
revoke all on public.travel_bookings from anon,authenticated;
grant select on public.travel_bookings to authenticated;
drop trigger if exists bookings_audit on public.travel_bookings;
create trigger bookings_audit after insert or update on public.travel_bookings for each row execute function private.audit_change();
create or replace function public.tf_booking_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); tid uuid:=(p->>'tripId')::uuid; rid uuid:=(p->>'id')::uuid; op uuid:=(p->>'operationId')::uuid;
 role_name text; old_row public.travel_bookings; result jsonb; receipt private.mutation_receipts; h text:=md5(p::text); d jsonb:=p->'data'; item uuid; budget uuid; parent uuid; field text;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.tf_account_active(u) then raise exception 'ACCOUNT_DEACTIVATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text,0));
 role_name:=private.trip_role(tid);
 if role_name is null or role_name not in ('owner','editor') then raise exception 'FORBIDDEN';end if;
 if op is null or rid is null then raise exception 'INVALID_REQUEST';end if;
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>h then raise exception 'IDEMPOTENCY_MISMATCH'; end if;return receipt.result;end if;
 select * into old_row from public.travel_bookings where id=rid and trip_id=tid for update;
 if p->>'action' in ('update','delete') then
  if old_row.id is null or old_row.deleted_at is not null then raise exception 'NOT_FOUND';end if;
  if old_row.version<>(p->>'version')::integer or p->>'version' is null then raise exception 'STALE_VERSION';end if;
 elsif p->>'action'<>'create' or old_row.id is not null then raise exception 'INVALID_REQUEST';end if;
 if p->>'action'='delete' then
  update public.travel_bookings set deleted_at=now(),version=version+1,updated_at=now() where id=rid returning to_jsonb(travel_bookings.*) into result;
 else
  if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>24000 then raise exception 'INVALID_DATA';end if;
  if d->>'kind' is null or d->>'status' is null or d->>'title' is null then raise exception 'INVALID_DATA';end if;
  foreach field in array array['provider','code','holder','location','contact','note','timezone','url','map_url','start_at','end_at','deadline','cancel_by'] loop
   if length(coalesce(d->>field,''))>4000 then raise exception 'FIELD_TOO_LONG';end if;
  end loop;
  if coalesce((d->>'quantity')::integer,1) not between 1 and 10000 then raise exception 'INVALID_QUANTITY';end if;
  if not exists(select 1 from pg_timezone_names where name=coalesce(nullif(d->>'timezone',''),'Asia/Ho_Chi_Minh')) then raise exception 'INVALID_TIMEZONE';end if;
  foreach field in array array['start_at','end_at','deadline','cancel_by'] loop
   if nullif(d->>field,'') is not null then perform (d->>field)::timestamptz;end if;
  end loop;
  if nullif(d->>'end_at','') is not null and nullif(d->>'start_at','') is null then raise exception 'START_REQUIRED';end if;
  if (nullif(d->>'end_at',''))::timestamptz < (nullif(d->>'start_at',''))::timestamptz then raise exception 'INVALID_TIME_RANGE';end if;
  foreach field in array array['url','map_url'] loop
   if nullif(d->>field,'') is not null and (d->>field !~ '^https://[^[:space:]]+$' or d->>field ~ '[<>"'']') then raise exception 'HTTPS_REQUIRED';end if;
  end loop;
  item:=nullif(d->>'item_id','')::uuid; budget:=nullif(d->>'budget_id','')::uuid; parent:=nullif(d->>'booking_id','')::uuid;
  if item is not null and not exists(select 1 from public.itinerary_items where id=item and trip_id=tid and deleted_at is null) then raise exception 'INVALID_ITEM';end if;
  if budget is not null and not exists(select 1 from public.budget_items where id=budget and trip_id=tid and deleted_at is null) then raise exception 'INVALID_BUDGET';end if;
  if parent is not null and (parent=rid or not exists(select 1 from public.travel_bookings where id=parent and trip_id=tid and kind<>'document' and deleted_at is null)) then raise exception 'INVALID_BOOKING';end if;
  if p->>'action'='create' then
   insert into public.travel_bookings(id,trip_id,kind,title,status,item_id,budget_id,booking_id,payload) values(rid,tid,d->>'kind',trim(d->>'title'),d->>'status',item,budget,parent,d) returning to_jsonb(travel_bookings.*) into result;
  else
   update public.travel_bookings set kind=d->>'kind',title=trim(d->>'title'),status=d->>'status',item_id=item,budget_id=budget,booking_id=parent,payload=d,version=version+1,updated_at=now() where id=rid returning to_jsonb(travel_bookings.*) into result;
  end if;
 end if;
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,tid,h,result);
 return result;
end;$$;
revoke all on function public.tf_booking_mutate(jsonb) from public,anon;
grant execute on function public.tf_booking_mutate(jsonb) to authenticated;
-- Preserve prior readiness checks while advancing the capability marker.
do $$begin if to_regprocedure('public.tf_release_readiness_v241()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v241;end if;end$$;
revoke all on function public.tf_release_readiness_v241() from public,anon,authenticated;
insert into public.tf_schema_versions(version,migration_name) values('2.8.0','202611010001_v280_bookings_documents.sql') on conflict(version) do nothing;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; ok boolean;
begin
 r:=public.tf_release_readiness_v241();
 ok:=to_regclass('public.travel_bookings') is not null and exists(select 1 from pg_class where oid='public.travel_bookings'::regclass and relrowsecurity);
 return r || jsonb_build_object('app_version','2.8.0','database_version','2.8.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks') || jsonb_build_array(jsonb_build_object('key','bookings','label','Bookings & Documents V2.8.0','ok',ok)));
end;$$;
revoke all on function public.tf_release_readiness() from public,anon;
grant execute on function public.tf_release_readiness() to authenticated;
commit;
