begin;

-- V0.5.0 Collaboration & Permission Control
-- Keep account identities (trip_members) separate from travellers (trip_participants),
-- while strengthening invitation hygiene and instant access-change signalling.

alter table public.trip_members
  add column if not exists updated_at timestamptz not null default now();

alter table public.trip_invitations
  add column if not exists updated_at timestamptz not null default now();

-- Normalize duplicate pending invitations before enforcing one live invite per email/trip.
with ranked as (
  select id,
         row_number() over (
           partition by trip_id, lower(email)
           order by created_at desc, id desc
         ) as rn
  from public.trip_invitations
  where used_at is null and revoked_at is null
)
update public.trip_invitations i
set revoked_at = now(), updated_at = now(), version = version + 1
from ranked r
where i.id = r.id and r.rn > 1;

create unique index if not exists one_pending_invitation_per_email
  on public.trip_invitations(trip_id, lower(email))
  where used_at is null and revoked_at is null;

create or replace function private.tf_touch_updated_at() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.tf_touch_updated_at() from public;

drop trigger if exists tf_member_touch_updated_at on public.trip_members;
create trigger tf_member_touch_updated_at
before update on public.trip_members
for each row execute function private.tf_touch_updated_at();

drop trigger if exists tf_invitation_touch_updated_at on public.trip_invitations;
create trigger tf_invitation_touch_updated_at
before update on public.trip_invitations
for each row execute function private.tf_touch_updated_at();

-- Prevent inviting an account that already has access and prevent duplicate live invites.
create or replace function private.tf_invitation_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare normalized_email text := lower(btrim(new.email));
begin
  new.email := normalized_email;
  if exists (
    select 1
    from public.trips t
    join auth.users u on u.id=t.owner_id
    where t.id=new.trip_id and lower(coalesce(u.email,''))=normalized_email
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (
    select 1
    from public.trip_members m
    join auth.users u on u.id=m.user_id
    where m.trip_id=new.trip_id and lower(coalesce(u.email,m.email,''))=normalized_email
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (
    select 1 from public.trip_invitations i
    where i.trip_id=new.trip_id
      and lower(i.email)=normalized_email
      and i.used_at is null
      and i.revoked_at is null
      and i.id<>new.id
  ) then
    raise exception 'INVITE_PENDING_EXISTS';
  end if;
  return new;
end;
$$;
revoke all on function private.tf_invitation_guard() from public;

drop trigger if exists tf_invitation_guard on public.trip_invitations;
create trigger tf_invitation_guard
before insert or update of email on public.trip_invitations
for each row execute function private.tf_invitation_guard();

-- Dedicated event stream lets the affected account learn about role/revoke changes
-- even when the trip itself becomes unreadable immediately after revocation.
create table if not exists public.trip_access_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid,
  event_type text not null check(event_type in ('granted','role_changed','revoked')),
  role text check(role in ('editor','viewer')),
  created_at timestamptz not null default now()
);
create index if not exists trip_access_events_target
  on public.trip_access_events(target_user_id, created_at desc);

alter table public.trip_access_events enable row level security;
drop policy if exists target_reads_access_events on public.trip_access_events;
create policy target_reads_access_events on public.trip_access_events
for select to authenticated
using(target_user_id=auth.uid() and private.tf_account_active(auth.uid()));
revoke all on public.trip_access_events from anon, authenticated;
grant select on public.trip_access_events to authenticated;

create or replace function private.tf_member_access_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.trip_access_events(trip_id,target_user_id,actor_id,event_type,role)
    values(new.trip_id,new.user_id,auth.uid(),'granted',new.role);
    return new;
  elsif tg_op='UPDATE' then
    if old.role is distinct from new.role then
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
revoke all on function private.tf_member_access_event() from public;

drop trigger if exists tf_member_access_event on public.trip_members;
create trigger tf_member_access_event
after insert or update or delete on public.trip_members
for each row execute function private.tf_member_access_event();

-- Publish collaboration/access changes when Realtime is available.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='trip_access_events'
    ) then
      alter publication supabase_realtime add table public.trip_access_events;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='trip_invitations'
    ) then
      alter publication supabase_realtime add table public.trip_invitations;
    end if;
  end if;
end $$;

commit;
