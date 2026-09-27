begin;

-- V0.2.0 account administration. A missing row means a normal, active account.
create table public.tf_user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','master')),
  status text not null default 'active' check (status in ('active','deactivated')),
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),
  note text not null default '' check (length(note) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tf_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index tf_admin_audit_order on public.tf_admin_audit(created_at desc);

alter table public.tf_user_accounts enable row level security;
alter table public.tf_admin_audit enable row level security;
revoke all on public.tf_user_accounts, public.tf_admin_audit from anon, authenticated;

create function private.tf_account_active(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select case
    when uid is null then false
    else coalesce((select a.status='active' from public.tf_user_accounts a where a.user_id=uid), true)
  end;
$$;
create function private.tf_is_master(uid uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select a.role='master' and a.status='active' from public.tf_user_accounts a where a.user_id=uid), false);
$$;
revoke all on function private.tf_account_active(uuid), private.tf_is_master(uuid) from public;

-- Deactivated accounts lose all ordinary trip reads immediately.
create or replace function private.trip_role(t uuid) returns text
language sql stable security definer set search_path='' as $$
  select case
    when not private.tf_account_active(auth.uid()) then null
    when x.owner_id=auth.uid() then 'owner'
    else (select m.role from public.trip_members m where m.trip_id=x.id and m.user_id=auth.uid())
  end
  from public.trips x where x.id=t and x.deleted_at is null;
$$;
revoke all on function private.trip_role(uuid) from public;
grant execute on function private.trip_role(uuid) to authenticated;

create policy tf_user_account_self_read on public.tf_user_accounts
for select to authenticated
using (user_id=auth.uid() and private.tf_account_active(auth.uid()));
create policy tf_admin_audit_master_read on public.tf_admin_audit
for select to authenticated
using (private.tf_is_master(auth.uid()));
grant select on public.tf_user_accounts, public.tf_admin_audit to authenticated;

create function public.tf_account_state() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); a public.tf_user_accounts;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  select * into a from public.tf_user_accounts where user_id=u;
  return jsonb_build_object(
    'user_id',u,
    'role',coalesce(a.role,'user'),
    'status',coalesce(a.status,'active'),
    'deactivated_at',a.deactivated_at
  );
end;
$$;
revoke all on function public.tf_account_state() from public,anon;
grant execute on function public.tf_account_state() to authenticated;

-- Keep the proven V0.1 mutation engine, but gate every write by current account status.
alter function public.tf_mutate(jsonb) rename to tf_mutate_v010;
revoke execute on function public.tf_mutate_v010(jsonb) from authenticated, anon, public;
create function public.tf_mutate(req jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not private.tf_account_active(auth.uid()) then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  return public.tf_mutate_v010(req);
end;
$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;
grant execute on function public.tf_mutate(jsonb) to authenticated;

create function public.tf_admin_overview(search_text text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.tf_is_master(auth.uid()) then raise exception 'MASTER_ONLY'; end if;
  with users_data as (
    select
      u.id,
      coalesce(u.email,'') as email,
      u.created_at,
      u.last_sign_in_at,
      coalesce(a.role,'user') as role,
      coalesce(a.status,'active') as status,
      a.deactivated_at,
      coalesce((select count(*) from public.trips t where t.owner_id=u.id and t.deleted_at is null),0)::int as trip_count,
      coalesce((select count(*) from public.audit_logs l where l.actor_id=u.id),0)::int as activity_count
    from auth.users u
    left join public.tf_user_accounts a on a.user_id=u.id
    where search_text='' or coalesce(u.email,'') ilike '%'||search_text||'%' or u.id::text ilike '%'||search_text||'%'
    order by u.created_at desc
    limit 500
  )
  select jsonb_build_object(
    'users',coalesce(jsonb_agg(to_jsonb(users_data)),'[]'::jsonb),
    'stats',jsonb_build_object(
      'total',(select count(*) from auth.users),
      'active',(select count(*) from auth.users u left join public.tf_user_accounts a on a.user_id=u.id where coalesce(a.status,'active')='active'),
      'deactivated',(select count(*) from public.tf_user_accounts where status='deactivated'),
      'trips',(select count(*) from public.trips where deleted_at is null)
    )
  ) into result from users_data;
  return result;
end;
$$;

create function public.tf_admin_user_detail(target_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.tf_is_master(auth.uid()) then raise exception 'MASTER_ONLY'; end if;
  if not exists(select 1 from auth.users where id=target_user) then raise exception 'USER_NOT_FOUND'; end if;
  select jsonb_build_object(
    'user',(select jsonb_build_object(
      'id',u.id,'email',coalesce(u.email,''),'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,
      'role',coalesce(a.role,'user'),'status',coalesce(a.status,'active'),'deactivated_at',a.deactivated_at
    ) from auth.users u left join public.tf_user_accounts a on a.user_id=u.id where u.id=target_user),
    'trips',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'name',t.name,'destination',t.destination,'start_date',t.start_date,'end_date',t.end_date,
        'status',t.status,'owner_id',t.owner_id,'version',t.version,
        'access_role',case when t.owner_id=target_user then 'owner' else m.role end,
        'items',(select count(*) from public.itinerary_items x where x.trip_id=t.id and x.deleted_at is null),
        'budgets',(select count(*) from public.budget_items x where x.trip_id=t.id and x.deleted_at is null),
        'expenses',(select count(*) from public.expenses x where x.trip_id=t.id and x.deleted_at is null),
        'media',(select count(*) from public.media_links x where x.trip_id=t.id and x.deleted_at is null)
      ) order by t.start_date desc)
      from public.trips t
      left join public.trip_members m on m.trip_id=t.id and m.user_id=target_user
      where t.deleted_at is null and (t.owner_id=target_user or m.user_id=target_user)
    ),'[]'::jsonb),
    'activity',coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select id,trip_id,entity,record_id,action,created_at,before_data,after_data
        from public.audit_logs where actor_id=target_user order by created_at desc limit 100
      ) x
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.tf_admin_trip_detail(target_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.tf_is_master(auth.uid()) then raise exception 'MASTER_ONLY'; end if;
  if not exists(select 1 from public.trips where id=target_trip) then raise exception 'NOT_FOUND'; end if;
  select jsonb_build_object(
    'trip',(select to_jsonb(t) from public.trips t where t.id=target_trip),
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at) from public.itinerary_items x where x.trip_id=target_trip),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.budget_items x where x.trip_id=target_trip),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.spent_on,x.created_at) from public.expenses x where x.trip_id=target_trip),'[]'::jsonb),
    'media',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.media_links x where x.trip_id=target_trip),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.trip_participants x where x.trip_id=target_trip),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.trip_members x where x.trip_id=target_trip),'[]'::jsonb),
    'snapshots',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.budget_snapshots x where x.trip_id=target_trip),'[]'::jsonb),
    'audits',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select * from public.audit_logs where trip_id=target_trip order by created_at desc limit 200) x),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.tf_admin_set_user_status(target_user uuid,new_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; current_role text;
begin
  if not private.tf_is_master(auth.uid()) then raise exception 'MASTER_ONLY'; end if;
  if new_status not in ('active','deactivated') then raise exception 'INVALID_STATUS'; end if;
  if target_user=auth.uid() then raise exception 'MASTER_SELF_PROTECTED'; end if;
  if not exists(select 1 from auth.users where id=target_user) then raise exception 'USER_NOT_FOUND'; end if;
  select coalesce(role,'user'),to_jsonb(a) into current_role,before_row from public.tf_user_accounts a where user_id=target_user;
  if current_role='master' then raise exception 'MASTER_PROTECTED'; end if;
  insert into public.tf_user_accounts(user_id,role,status,deactivated_at,deactivated_by,updated_at)
  values(target_user,'user',new_status,case when new_status='deactivated' then now() else null end,case when new_status='deactivated' then auth.uid() else null end,now())
  on conflict(user_id) do update set
    status=excluded.status,
    deactivated_at=excluded.deactivated_at,
    deactivated_by=excluded.deactivated_by,
    version=public.tf_user_accounts.version+1,
    updated_at=now()
  returning to_jsonb(tf_user_accounts.*) into after_row;
  insert into public.tf_admin_audit(actor_id,target_user_id,action,before_data,after_data)
  values(auth.uid(),target_user,'ACCOUNT_'||upper(new_status),before_row,after_row);
  return after_row;
end;
$$;

revoke all on function public.tf_admin_overview(text), public.tf_admin_user_detail(uuid), public.tf_admin_trip_detail(uuid), public.tf_admin_set_user_status(uuid,text) from public,anon;
grant execute on function public.tf_admin_overview(text), public.tf_admin_user_detail(uuid), public.tf_admin_trip_detail(uuid), public.tf_admin_set_user_status(uuid,text) to authenticated;

commit;
