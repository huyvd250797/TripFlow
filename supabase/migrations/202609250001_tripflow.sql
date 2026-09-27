-- TripFlow 0.1.0. Run once on a NEW Supabase project.
begin;
create schema if not exists private;
revoke all on schema private from public;
create table public.trips (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(btrim(name)) between 1 and 160), destination text not null default '' check(length(destination)<=300),
 start_date date not null, end_date date not null, timezone text not null default 'Asia/Ho_Chi_Minh',
 people integer not null default 1 check(people between 1 and 999),
 status text not null default 'planning' check(status in ('planning','ready','traveling','completed','cancelled')),
 note text not null default '' check(length(note)<=5000), version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 check(end_date>=start_date and end_date-start_date<=730)
);
create table public.trip_members (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 user_id uuid not null references auth.users(id), email text not null, role text not null check(role in ('editor','viewer')),
 version integer not null default 1, created_at timestamptz not null default now(), unique(trip_id,user_id)
);
create table public.itinerary_items (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200), location text not null default '' check(length(location)<=300),
 start_at timestamptz not null, end_at timestamptz not null,
 status text not null default 'planned' check(status in ('planned','active','done','skipped')),
 map_url text not null default '' check(map_url='' or map_url ~ '^https://[^[:space:]]+$'),
 note text not null default '' check(length(note)<=5000), checked_in_at timestamptz, completed_at timestamptz,
 version integer not null default 1, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(trip_id,id), check(end_at>start_at)
);
create unique index one_active_item on public.itinerary_items(trip_id) where status='active' and deleted_at is null;
create index itinerary_order on public.itinerary_items(trip_id,start_at) where deleted_at is null;
create table public.budget_items (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 item_id uuid, title text not null check(length(btrim(title)) between 1 and 200),
 category text not null check(category in ('Di chuyển','Lưu trú','Ăn uống','Tham quan','Mua sắm','Khác')),
 quantity numeric(10,2) not null default 1 check(quantity>0 and quantity<=100000),
 unit_price bigint not null check(unit_price between 0 and 1000000000000),
 amount bigint generated always as (round(quantity*unit_price)::bigint) stored,
 note text not null default '' check(length(note)<=5000), version integer not null default 1,
 deleted_at timestamptz, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(trip_id,id), foreign key(trip_id,item_id) references public.itinerary_items(trip_id,id),check(quantity*unit_price<=1000000000000)
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
 budget_id uuid, refund_of uuid, kind text not null default 'payment' check(kind in ('payment','refund')),
 title text not null check(length(btrim(title)) between 1 and 200),category text not null check(category in ('Di chuyển','Lưu trú','Ăn uống','Tham quan','Mua sắm','Khác')),
 amount bigint not null check(amount between 1 and 1000000000000), spent_on date not null,
 payer text not null default '' check(length(payer)<=160),note text not null default '' check(length(note)<=5000),
 receipt_url text not null default '' check(receipt_url='' or receipt_url ~ '^https://[^[:space:]]+$'),
 version integer not null default 1, deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(trip_id,id), foreign key(trip_id,budget_id) references public.budget_items(trip_id,id),
 foreign key(trip_id,refund_of) references public.expenses(trip_id,id),check((kind='refund')=(refund_of is not null)),check(refund_of is distinct from id)
);
create index expense_order on public.expenses(trip_id,spent_on) where deleted_at is null;
create table public.media_links (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,item_id uuid,
 title text not null check(length(btrim(title)) between 1 and 200),kind text not null check(kind in ('album','photo','video','document')),
 url text not null check(url ~ '^https://[^[:space:]]+$' and length(url)<=3000),note text not null default '' check(length(note)<=5000),
 version integer not null default 1,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(trip_id,item_id) references public.itinerary_items(trip_id,id)
);
create table public.trip_participants (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),note text not null default '' check(length(note)<=5000),
 version integer not null default 1,deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.trip_invitations (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,email text not null,
 role text not null check(role in ('editor','viewer')),token uuid not null unique default gen_random_uuid(),
 expires_at timestamptz not null default now()+interval '7 days',used_at timestamptz,revoked_at timestamptz,version integer not null default 1,created_at timestamptz not null default now()
);
create table public.budget_snapshots (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips on delete cascade,
 title text not null, data jsonb not null,created_by uuid not null,created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key,trip_id uuid not null references public.trips on delete cascade,
 actor_id uuid,entity text not null,record_id uuid,action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
create index audit_order on public.audit_logs(trip_id,created_at desc);
create table private.mutation_receipts (
 user_id uuid not null, operation_id uuid not null, trip_id uuid not null,request_hash text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,operation_id)
);
create function private.trip_role(t uuid) returns text language sql stable security definer set search_path='' as $$
 select case when x.owner_id=auth.uid() then 'owner' else (select m.role from public.trip_members m where m.trip_id=x.id and m.user_id=auth.uid()) end
 from public.trips x where x.id=t and x.deleted_at is null;
$$;
revoke all on function private.trip_role(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.trip_role(uuid) to authenticated;
-- Audit trigger runs inside the same mutation transaction. Clients cannot modify logs.
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 declare tr uuid;
 begin
 if TG_TABLE_NAME='trips' then tr:=new.id; else tr:=new.trip_id; end if;
 insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,before_data,after_data)
 values(tr,auth.uid(),TG_TABLE_NAME,new.id,TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
 end;
$$;
revoke all on function private.audit_change() from public;
do $$ declare t text; begin
 foreach t in array array['trips','itinerary_items','budget_items','expenses','media_links','trip_participants','trip_members','budget_snapshots'] loop
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
-- SELECT only for clients; all writes pass through a checked transactional RPC.
alter table public.trips enable row level security;
create policy trip_read on public.trips for select to authenticated using(private.trip_role(id) is not null);
do $$ declare t text; begin
 foreach t in array array['trip_members','itinerary_items','budget_items','expenses','media_links','trip_participants','budget_snapshots','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy member_read on public.%I for select to authenticated using(private.trip_role(trip_id) is not null)',t);
 end loop;
end $$;
alter table public.trip_invitations enable row level security;
create policy owner_invites on public.trip_invitations for select to authenticated using(private.trip_role(trip_id)='owner');
revoke all on all tables in schema public from anon,authenticated;
grant select on public.trips,public.trip_members,public.itinerary_items,public.budget_items,public.expenses,public.media_links,public.trip_participants,public.trip_invitations,public.budget_snapshots,public.audit_logs to authenticated;

create function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); tid uuid:=(req->>'tripId')::uuid; rid uuid:=coalesce(nullif(req->>'id','')::uuid,gen_random_uuid());
 op uuid:=(req->>'operationId')::uuid; ent text:=req->>'entity'; act text:=req->>'action'; d jsonb:=coalesce(req->'data','{}');
 expected integer:=(req->>'version')::integer; tbl text; v integer; result jsonb; receipt private.mutation_receipts;
 tr public.trips; role_name text; it public.itinerary_items; budget public.budget_items; original public.expenses; ex public.expenses;
 inv public.trip_invitations; active_id uuid; actual_refund bigint; start_time timestamptz; end_time timestamptz;
begin
 if u is null then raise exception 'UNAUTHORIZED'; end if;
 if op is null or ent is null or act not in ('create','update','delete','status','accept') then raise exception 'INVALID_REQUEST';end if;
 if length(req::text)>50000 then raise exception 'PAYLOAD_TOO_LARGE';end if;
 -- Serialize same operation across trips, then serialize writes within one trip.
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));
 if ent='invitation' and act='accept' then
 select * into inv from public.trip_invitations where token=(d->>'token')::uuid;
 if not found or inv.revoked_at is not null or inv.expires_at<now() then raise exception 'INVITE_INVALID'; end if;
 if lower(inv.email)<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'INVITE_EMAIL_MISMATCH';end if;
 tid:=inv.trip_id;
 end if;
 if tid is null then raise exception 'INVALID_TRIP';end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text,1));
 -- Lock invitation only after trip lock, matching the revocation lock order.
 if ent='invitation' and act='accept' then
 select * into inv from public.trip_invitations where token=(d->>'token')::uuid for update;
 if not found or inv.revoked_at is not null or inv.expires_at<now() then raise exception 'INVITE_INVALID';end if;
 end if;
 role_name:=private.trip_role(tid);
 if not(ent='trip' and act='create') and not(ent='invitation' and act='accept') then
 if role_name is null then raise exception 'FORBIDDEN';end if;
 if role_name='viewer' then raise exception 'READ_ONLY';end if;
 end if;
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then
 if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;
 return receipt.result;
 end if;
 if (ent in ('invitation','member','snapshot') and act<>'accept') or (ent='trip' and act='delete') then
 if role_name is distinct from 'owner' then raise exception 'OWNER_ONLY';end if;
 end if;
 select * into tr from public.trips where id=tid and deleted_at is null for update;
 if ent='trip' and act='create' then
 if exists(select 1 from public.trips where id=tid) then raise exception 'CONFLICT';end if;
 if not exists(select 1 from pg_timezone_names where name=d->>'timezone') then raise exception 'INVALID_TIMEZONE';end if;
 insert into public.trips(id,owner_id,name,destination,start_date,end_date,timezone,people,status,note)
 values(tid,u,btrim(d->>'name'),coalesce(d->>'destination',''),(d->>'start_date')::date,(d->>'end_date')::date,d->>'timezone',coalesce((d->>'people')::int,1),coalesce(d->>'status','planning'),coalesce(d->>'note','')) returning to_jsonb(trips.*) into result;
 elsif ent='invitation' and act='accept' then
 if tr.id is null then raise exception 'INVITE_INVALID';end if;
 if inv.used_at is not null then raise exception 'INVITE_ALREADY_USED';end if;
 if tr.owner_id=u then raise exception 'ALREADY_OWNER';end if;
 insert into public.trip_members(trip_id,user_id,email,role) values(tid,u,lower(inv.email),inv.role)
 on conflict(trip_id,user_id) do update set role=excluded.role,version=public.trip_members.version+1;
 update public.trip_invitations set used_at=now() where id=inv.id;
 result:=jsonb_build_object('trip_id',tid);
 elsif ent='snapshot' and act='create' then
 insert into public.budget_snapshots(trip_id,title,data,created_by) values(tid,coalesce(nullif(d->>'title',''),'Dự toán đã chốt'),coalesce((select jsonb_agg(to_jsonb(b)) from public.budget_items b where trip_id=tid and deleted_at is null),'[]'),u) returning to_jsonb(budget_snapshots.*) into result;
 else
 if tr.id is null then raise exception 'NOT_FOUND';end if;
 tbl:=case ent when 'trip' then 'trips' when 'item' then 'itinerary_items' when 'budget' then 'budget_items' when 'expense' then 'expenses' when 'media' then 'media_links' when 'participant' then 'trip_participants' when 'invitation' then 'trip_invitations' when 'member' then 'trip_members' else null end;
 if tbl is null then raise exception 'INVALID_ENTITY';end if;
 if ent='trip' then rid:=tid;end if;
 if act<>'create' then
 if expected is null then raise exception 'VERSION_REQUIRED';end if;
 if ent='trip' then v:=tr.version;
 else execute format('select version from public.%I where id=$1 and trip_id=$2',tbl) into v using rid,tid;end if;
 if v is null then raise exception 'NOT_FOUND';end if;
 if v<>expected then raise exception 'CONFLICT';end if;
 if ent not in ('member','invitation','trip') then
 execute format('select to_jsonb(x) from public.%I x where id=$1 and deleted_at is null',tbl) into result using rid;
 if result is null then raise exception 'NOT_FOUND';end if;
 end if;
 end if;
 if act='delete' then
 if ent='member' then
 insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,before_data) select tid,u,'trip_members',id,'DELETE',to_jsonb(m) from public.trip_members m where id=rid;
 delete from public.trip_members where id=rid and trip_id=tid;
 elsif ent='invitation' then update public.trip_invitations set revoked_at=now(),version=version+1 where id=rid and trip_id=tid;
 else
 if ent='expense' and exists(select 1 from public.expenses where refund_of=rid and deleted_at is null) then raise exception 'HAS_REFUNDS';end if;
 if ent='budget' then update public.expenses set budget_id=null,version=version+1,updated_at=now() where trip_id=tid and budget_id=rid;end if;
 if ent='item' then
 update public.budget_items set item_id=null,version=version+1,updated_at=now() where trip_id=tid and item_id=rid;
 update public.media_links set item_id=null,version=version+1,updated_at=now() where trip_id=tid and item_id=rid;
 end if;
 execute format('update public.%I set deleted_at=now(),version=version+1,updated_at=now() where id=$1',tbl) using rid;
 end if;
 result:=jsonb_build_object('id',rid,'deleted',true);
 elsif ent='trip' and act='update' then
 if not exists(select 1 from pg_timezone_names where name=d->>'timezone') then raise exception 'INVALID_TIMEZONE';end if;
 if exists(select 1 from public.itinerary_items where trip_id=tid and deleted_at is null and ((start_at at time zone (d->>'timezone'))::date<(d->>'start_date')::date or (end_at at time zone (d->>'timezone'))::date>(d->>'end_date')::date)) then raise exception 'ITEM_OUTSIDE_TRIP';end if;
 update public.trips set name=btrim(d->>'name'),destination=coalesce(d->>'destination',''),start_date=(d->>'start_date')::date,end_date=(d->>'end_date')::date,timezone=d->>'timezone',people=(d->>'people')::int,status=d->>'status',note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=tid returning to_jsonb(trips.*) into result;
 elsif ent='item' and act='status' then
 if d->>'status' not in ('planned','active','done','skipped') then raise exception 'INVALID_STATUS';end if;
 select id into active_id from public.itinerary_items where trip_id=tid and status='active' and deleted_at is null;
 if d->>'status'='active' and active_id is not null and active_id<>rid then
 if nullif(d->>'previous_id','')::uuid is distinct from active_id then raise exception 'ACTIVE_CHANGED';end if;
 update public.itinerary_items set status='done',completed_at=now(),version=version+1,updated_at=now() where id=active_id;
 end if;
 update public.itinerary_items set status=d->>'status',checked_in_at=case when d->>'status'='active' then now() when d->>'status'='planned' then null else checked_in_at end,completed_at=case when d->>'status'='done' then now() else null end,version=version+1,updated_at=now() where id=rid returning to_jsonb(itinerary_items.*) into result;
 if d->>'status'='active' then update public.trips set status='traveling',version=version+1,updated_at=now() where id=tid;end if;
 elsif ent='item' and act in ('create','update') then
 start_time:=(d->>'start_at')::timestamptz;end_time:=(d->>'end_at')::timestamptz;
 if (start_time at time zone tr.timezone)::date<tr.start_date or (end_time at time zone tr.timezone)::date>tr.end_date then raise exception 'ITEM_OUTSIDE_TRIP';end if;
 if act='create' then
 insert into public.itinerary_items(id,trip_id,title,location,start_at,end_at,map_url,note) values(rid,tid,btrim(d->>'title'),coalesce(d->>'location',''),start_time,end_time,coalesce(d->>'map_url',''),coalesce(d->>'note','')) returning to_jsonb(itinerary_items.*) into result;
 else update public.itinerary_items set title=btrim(d->>'title'),location=coalesce(d->>'location',''),start_at=start_time,end_at=end_time,map_url=coalesce(d->>'map_url',''),note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=rid returning to_jsonb(itinerary_items.*) into result;end if;
 elsif ent='budget' and act in ('create','update') then
 if nullif(d->>'item_id','') is not null and not exists(select 1 from public.itinerary_items where id=(d->>'item_id')::uuid and trip_id=tid and deleted_at is null) then raise exception 'INVALID_LINK';end if;
 if act='create' then insert into public.budget_items(id,trip_id,item_id,title,category,quantity,unit_price,note) values(rid,tid,nullif(d->>'item_id','')::uuid,btrim(d->>'title'),d->>'category',(d->>'quantity')::numeric,(d->>'unit_price')::bigint,coalesce(d->>'note','')) returning to_jsonb(budget_items.*) into result;
 else update public.budget_items set item_id=nullif(d->>'item_id','')::uuid,title=btrim(d->>'title'),category=d->>'category',quantity=(d->>'quantity')::numeric,unit_price=(d->>'unit_price')::bigint,note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=rid returning to_jsonb(budget_items.*) into result;
 update public.expenses set category=d->>'category',version=version+1,updated_at=now() where budget_id=rid;end if;
 elsif ent='expense' and act in ('create','update') then
 if act='update' then select * into ex from public.expenses where id=rid;
 if exists(select 1 from public.expenses where refund_of=rid and deleted_at is null) then raise exception 'HAS_REFUNDS';end if;end if;
 if d->>'kind'='refund' then
 select * into original from public.expenses where id=nullif(d->>'refund_of','')::uuid and trip_id=tid and deleted_at is null and kind='payment';
 if original.id is null then raise exception 'INVALID_REFUND';end if;
 select coalesce(sum(amount),0) into actual_refund from public.expenses where refund_of=original.id and deleted_at is null and id<>rid;
 if actual_refund+(d->>'amount')::bigint>original.amount then raise exception 'REFUND_EXCEEDED';end if;
 d:=d||jsonb_build_object('category',original.category,'budget_id',original.budget_id);
 else d:=d||jsonb_build_object('refund_of',null);
 if nullif(d->>'budget_id','') is not null then
 select * into budget from public.budget_items where id=(d->>'budget_id')::uuid and trip_id=tid and deleted_at is null;
 if budget.id is null then raise exception 'INVALID_LINK';end if;
 d:=d||jsonb_build_object('category',budget.category);end if;end if;
 if act='create' then insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url) values(rid,tid,nullif(d->>'budget_id','')::uuid,nullif(d->>'refund_of','')::uuid,d->>'kind',btrim(d->>'title'),d->>'category',(d->>'amount')::bigint,(d->>'spent_on')::date,coalesce(d->>'payer',''),coalesce(d->>'note',''),coalesce(d->>'receipt_url','')) returning to_jsonb(expenses.*) into result;
 else update public.expenses set budget_id=nullif(d->>'budget_id','')::uuid,refund_of=nullif(d->>'refund_of','')::uuid,kind=d->>'kind',title=btrim(d->>'title'),category=d->>'category',amount=(d->>'amount')::bigint,spent_on=(d->>'spent_on')::date,payer=coalesce(d->>'payer',''),note=coalesce(d->>'note',''),receipt_url=coalesce(d->>'receipt_url',''),version=version+1,updated_at=now() where id=rid returning to_jsonb(expenses.*) into result;end if;
 elsif ent='media' and act in ('create','update') then
 if nullif(d->>'item_id','') is not null and not exists(select 1 from public.itinerary_items where id=(d->>'item_id')::uuid and trip_id=tid and deleted_at is null) then raise exception 'INVALID_LINK';end if;
 if act='create' then insert into public.media_links(id,trip_id,item_id,title,kind,url,note) values(rid,tid,nullif(d->>'item_id','')::uuid,btrim(d->>'title'),d->>'kind',d->>'url',coalesce(d->>'note','')) returning to_jsonb(media_links.*) into result;
 else update public.media_links set item_id=nullif(d->>'item_id','')::uuid,title=btrim(d->>'title'),kind=d->>'kind',url=d->>'url',note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=rid returning to_jsonb(media_links.*) into result;end if;
 elsif ent='participant' and act in ('create','update') then
 if act='create' then insert into public.trip_participants(id,trip_id,name,note) values(rid,tid,btrim(d->>'name'),coalesce(d->>'note','')) returning to_jsonb(trip_participants.*) into result;
 else update public.trip_participants set name=btrim(d->>'name'),note=coalesce(d->>'note',''),version=version+1,updated_at=now() where id=rid returning to_jsonb(trip_participants.*) into result;end if;
 elsif ent='invitation' and act='create' then
 if d->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(d->>'email')>254 then raise exception 'INVALID_EMAIL';end if;
 insert into public.trip_invitations(id,trip_id,email,role) values(rid,tid,lower(btrim(d->>'email')),d->>'role') returning to_jsonb(trip_invitations.*) into result;
 elsif ent='member' and act='update' then
 update public.trip_members set role=d->>'role',version=version+1 where id=rid and trip_id=tid returning to_jsonb(trip_members.*) into result;
 else raise exception 'INVALID_ACTION';
 end if;
 end if;
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,tid,md5(req::text),result);
 return result;
end;
$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;
grant execute on function public.tf_mutate(jsonb) to authenticated;
-- Every child table has trip_id indexed for RLS reads.
create index member_user on public.trip_members(user_id,trip_id);
create index budget_trip on public.budget_items(trip_id);
create index media_trip on public.media_links(trip_id);
create index participant_trip on public.trip_participants(trip_id);
create index invitation_trip on public.trip_invitations(trip_id);
create index snapshot_trip on public.budget_snapshots(trip_id,created_at desc);
-- Realtime is optional; reads are still protected by RLS.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['trips','itinerary_items','budget_items','expenses','media_links','trip_participants','trip_members'] loop
 execute format('alter publication supabase_realtime add table public.%I',t);
 end loop;
 end if;
end $$;
commit;
