-- TripFlow V2.4.1 — Five independent permissions. Run after V1.4.0.
-- Additive upgrade: existing members/invites retain their role, with no special grants.
begin;
alter table public.trip_members
  add column if not exists can_invite boolean not null default false,
  add column if not exists can_change_roles boolean not null default false,
  add column if not exists can_revoke_access boolean not null default false,
  add column if not exists can_delete_trip boolean not null default false,
  add column if not exists can_close_budget boolean not null default false;
alter table public.trip_invitations
  add column if not exists can_invite boolean not null default false,
  add column if not exists can_change_roles boolean not null default false,
  add column if not exists can_revoke_access boolean not null default false,
  add column if not exists can_delete_trip boolean not null default false,
  add column if not exists can_close_budget boolean not null default false;

create or replace function private.tf_has_trip_permission(t uuid, permission_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select case when private.trip_role(t) is null then false
    when private.trip_role(t)='owner' then permission_name in ('can_invite','can_change_roles','can_revoke_access','can_delete_trip','can_close_budget')
    else coalesce((select case permission_name
      when 'can_invite' then m.can_invite
      when 'can_change_roles' then m.can_change_roles
      when 'can_revoke_access' then m.can_revoke_access
      when 'can_delete_trip' then m.can_delete_trip
      when 'can_close_budget' then m.can_close_budget
      else false end from public.trip_members m where m.trip_id=t and m.user_id=auth.uid()),false)
  end;
$$;
revoke all on function private.tf_has_trip_permission(uuid,text) from public,anon;
grant execute on function private.tf_has_trip_permission(uuid,text) to authenticated;

create or replace function public.tf_trip_permissions(target_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if private.trip_role(target_trip) is null then raise exception 'FORBIDDEN'; end if;
  return jsonb_build_object(
    'can_invite',private.tf_has_trip_permission(target_trip,'can_invite'),
    'can_change_roles',private.tf_has_trip_permission(target_trip,'can_change_roles'),
    'can_revoke_access',private.tf_has_trip_permission(target_trip,'can_revoke_access'),
    'can_delete_trip',private.tf_has_trip_permission(target_trip,'can_delete_trip'),
    'can_close_budget',private.tf_has_trip_permission(target_trip,'can_close_budget')
  );
end;
$$;
revoke all on function public.tf_trip_permissions(uuid) from public,anon;
grant execute on function public.tf_trip_permissions(uuid) to authenticated;

drop policy if exists owner_invites on public.trip_invitations;
create policy owner_invites on public.trip_invitations for select to authenticated using (
  private.tf_has_trip_permission(trip_id,'can_invite') or
  private.tf_has_trip_permission(trip_id,'can_change_roles') or
  private.tf_has_trip_permission(trip_id,'can_revoke_access')
);

create or replace function public.tf_mutate_v010(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if not ((ent in ('invitation','member','snapshot') and act<>'accept') or (ent='trip' and act='delete'))
    and role_name='viewer' then raise exception 'READ_ONLY';end if;
 end if;
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then
 if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;
 return receipt.result;
 end if;
 if (ent in ('invitation','member','snapshot') and act<>'accept') or (ent='trip' and act='delete') then
 if not private.tf_has_trip_permission(tid,case
   when ent='invitation' and act='create' then 'can_invite'
   when ent='member' and act='update' then 'can_change_roles'
   when ent in ('member','invitation') and act='delete' then 'can_revoke_access'
   when ent='trip' and act='delete' then 'can_delete_trip'
   when ent='snapshot' and act='create' then 'can_close_budget'
   else '' end) then raise exception 'PERMISSION_DENIED';end if;
 end if;
 select * into tr from public.trips where id=tid and deleted_at is null for update;
 if role_name is distinct from 'owner' and ent='invitation' and act='create' and (
 coalesce((d->>'can_invite')::boolean,false) or coalesce((d->>'can_change_roles')::boolean,false) or coalesce((d->>'can_revoke_access')::boolean,false) or coalesce((d->>'can_delete_trip')::boolean,false) or coalesce((d->>'can_close_budget')::boolean,false)
 ) then raise exception 'PERMISSION_GRANT_OWNER_ONLY';end if;
 if role_name is distinct from 'owner' and ent='member' and act='update' then
   if exists(select 1 from public.trip_members m where m.id=rid and m.trip_id=tid and m.user_id=u)
     then raise exception 'SELF_PERMISSION_CHANGE';end if;
   if exists(select 1 from public.trip_members m where m.id=rid and m.trip_id=tid and (
 (d ? 'can_invite' and (d->>'can_invite')::boolean is distinct from m.can_invite) or (d ? 'can_change_roles' and (d->>'can_change_roles')::boolean is distinct from m.can_change_roles) or (d ? 'can_revoke_access' and (d->>'can_revoke_access')::boolean is distinct from m.can_revoke_access) or (d ? 'can_delete_trip' and (d->>'can_delete_trip')::boolean is distinct from m.can_delete_trip) or (d ? 'can_close_budget' and (d->>'can_close_budget')::boolean is distinct from m.can_close_budget)
   )) then raise exception 'PERMISSION_GRANT_OWNER_ONLY';end if;
 end if;
 if ent='trip' and act='create' then
 if exists(select 1 from public.trips where id=tid) then raise exception 'CONFLICT';end if;
 if not exists(select 1 from pg_timezone_names where name=d->>'timezone') then raise exception 'INVALID_TIMEZONE';end if;
 insert into public.trips(id,owner_id,name,destination,start_date,end_date,timezone,people,status,note)
 values(tid,u,btrim(d->>'name'),coalesce(d->>'destination',''),(d->>'start_date')::date,(d->>'end_date')::date,d->>'timezone',coalesce((d->>'people')::int,1),coalesce(d->>'status','planning'),coalesce(d->>'note','')) returning to_jsonb(trips.*) into result;
 elsif ent='invitation' and act='accept' then
 if tr.id is null then raise exception 'INVITE_INVALID';end if;
 if inv.used_at is not null then raise exception 'INVITE_ALREADY_USED';end if;
 if tr.owner_id=u then raise exception 'ALREADY_OWNER';end if;
 insert into public.trip_members(trip_id,user_id,email,role,can_invite,can_change_roles,can_revoke_access,can_delete_trip,can_close_budget) values(tid,u,lower(inv.email),inv.role,inv.can_invite,inv.can_change_roles,inv.can_revoke_access,inv.can_delete_trip,inv.can_close_budget)
 on conflict(trip_id,user_id) do update set role=excluded.role,can_invite=excluded.can_invite,can_change_roles=excluded.can_change_roles,can_revoke_access=excluded.can_revoke_access,can_delete_trip=excluded.can_delete_trip,can_close_budget=excluded.can_close_budget,version=public.trip_members.version+1;
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
 insert into public.trip_invitations(id,trip_id,email,role,can_invite,can_change_roles,can_revoke_access,can_delete_trip,can_close_budget) values(rid,tid,lower(btrim(d->>'email')),d->>'role',coalesce((d->>'can_invite')::boolean,false),coalesce((d->>'can_change_roles')::boolean,false),coalesce((d->>'can_revoke_access')::boolean,false),coalesce((d->>'can_delete_trip')::boolean,false),coalesce((d->>'can_close_budget')::boolean,false)) returning to_jsonb(trip_invitations.*) into result;
 elsif ent='member' and act='update' then
 update public.trip_members set role=d->>'role',can_invite=coalesce((d->>'can_invite')::boolean,can_invite),can_change_roles=coalesce((d->>'can_change_roles')::boolean,can_change_roles),can_revoke_access=coalesce((d->>'can_revoke_access')::boolean,can_revoke_access),can_delete_trip=coalesce((d->>'can_delete_trip')::boolean,can_delete_trip),can_close_budget=coalesce((d->>'can_close_budget')::boolean,can_close_budget),version=version+1 where id=rid and trip_id=tid returning to_jsonb(trip_members.*) into result;
 else raise exception 'INVALID_ACTION';
 end if;
 end if;
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,tid,md5(req::text),result);
 return result;
end;
$$;

revoke all on function public.tf_mutate_v010(jsonb) from public,anon,authenticated;

create or replace function private.tf_member_access_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.trip_access_events(trip_id,target_user_id,actor_id,event_type,role)
    values(new.trip_id,new.user_id,auth.uid(),'granted',new.role);
    return new;
  elsif tg_op='UPDATE' then
    if old.role is distinct from new.role or old.can_invite is distinct from new.can_invite or old.can_change_roles is distinct from new.can_change_roles or old.can_revoke_access is distinct from new.can_revoke_access or old.can_delete_trip is distinct from new.can_delete_trip or old.can_close_budget is distinct from new.can_close_budget then
      insert into public.trip_access_events(trip_id,target_user_id,actor_id,event_type,role)
      values(new.trip_id,new.user_id,auth.uid(),'role_changed',new.role);
    end if;
    return new;
  else
    insert into public.trip_access_events(trip_id,target_user_id,actor_id,event_type,role)
    values(old.trip_id,old.user_id,auth.uid(),'revoked',old.role);
    return old;
  end if;
end;
$$;

revoke all on function private.tf_member_access_event() from public,anon,authenticated;

create or replace function public.tf_mutate(req jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  final_result jsonb;
  u uuid:=auth.uid();
  tid uuid:=nullif(req->>'tripId','')::uuid;
  rid uuid;
  op uuid:=nullif(req->>'operationId','')::uuid;
  d jsonb:=coalesce(req->'data','{}'::jsonb);
  receipt private.mutation_receipts;
begin
  if req->>'entity'<>'media' or req->>'action' not in ('create','update') then
    return public.tf_mutate_v120(req);
  end if;
  if u is null then raise exception 'UNAUTHORIZED';end if;
  if not private.tf_account_active(u) then raise exception 'ACCOUNT_DEACTIVATED';end if;
  if private.trip_role(tid) is null then raise exception 'FORBIDDEN';end if;
  if private.trip_role(tid)='viewer' then raise exception 'READ_ONLY';end if;
  if op is null then raise exception 'INVALID_REQUEST';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));
  perform pg_advisory_xact_lock(hashtextextended(tid::text,1));
  select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
  if found then
    if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;
    return receipt.result;
  end if;
  final_result:=public.tf_mutate_v120(req);
  rid:=(final_result->>'id')::uuid;
  if coalesce((d->>'is_cover')::boolean,false) then
    update public.media_links set is_cover=false,version=version+1,updated_at=now()
      where trip_id=tid and id<>rid and deleted_at is null and is_cover=true;
  end if;
  update public.media_links set taken_on=nullif(d->>'taken_on','')::date,
    is_highlight=coalesce((d->>'is_highlight')::boolean,false),
    is_cover=coalesce((d->>'is_cover')::boolean,false),
    story_order=greatest(coalesce((d->>'story_order')::int,0),0),updated_at=now()
    where id=rid and trip_id=tid and deleted_at is null;
  select to_jsonb(m) into final_result from public.media_links m where m.id=rid and m.trip_id=tid;
  update private.mutation_receipts set result=final_result where user_id=u and operation_id=op;
  return final_result;
end;
$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;
grant execute on function public.tf_mutate(jsonb) to authenticated;

insert into public.tf_schema_versions(version,migration_name) values ('2.4.1','202610310001_v241_travel_reliability_permissions.sql') on conflict(version) do nothing;
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

  select exists(select 1 from public.tf_schema_versions where version='2.4.1') into stable_marker_ok;
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
    jsonb_build_object('key','granular_permissions','label','Five independent permissions V2.4.1','ok',
      (select count(*)=10 from information_schema.columns where table_schema='public' and table_name in ('trip_members','trip_invitations')
      and column_name in ('can_invite','can_change_roles','can_revoke_access','can_delete_trip','can_close_budget'))
      and to_regprocedure('public.tf_trip_permissions(uuid)') is not null),
    jsonb_build_object('key','schema_marker','label','Schema marker V2.4.1','ok',coalesce(stable_marker_ok,false)),
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
    'app_version','2.4.1',
    'channel','stable',
    'database_version',case when stable_marker_ok then '2.4.1' else null end,
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
