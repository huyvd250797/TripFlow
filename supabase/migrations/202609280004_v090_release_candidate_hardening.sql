-- TripFlow V0.9.0 — Release Candidate & Hardening
-- Adds an explicit schema marker + authenticated release-readiness diagnostic.
begin;

create table if not exists public.tf_schema_versions (
  version text primary key,
  migration_name text not null unique,
  applied_at timestamptz not null default now()
);

alter table public.tf_schema_versions enable row level security;
revoke all on public.tf_schema_versions from public, anon, authenticated;

insert into public.tf_schema_versions(version, migration_name)
values ('0.9.0', '202609280004_v090_release_candidate_hardening.sql')
on conflict (version) do update
set migration_name = excluded.migration_name;

create or replace function public.tf_release_readiness() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  u uuid := auth.uid();
  account jsonb;
  rls_ok boolean;
  checks jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;

  account := public.tf_account_state();
  if coalesce(account->>'status','active') <> 'active' then
    raise exception 'ACCOUNT_DEACTIVATED';
  end if;

  select count(*) = 16 and bool_and(c.relrowsecurity)
  into rls_ok
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname = any(array[
      'trips','trip_members','itinerary_items','budget_items','expenses',
      'media_links','trip_participants','trip_invitations','budget_snapshots',
      'audit_logs','tf_user_accounts','tf_admin_audit','itinerary_events',
      'trip_access_events','trip_backups','tf_schema_versions'
    ]);

  checks := jsonb_build_array(
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
    'app_version','0.9.0',
    'channel','release-candidate',
    'database_version',case when exists(select 1 from public.tf_schema_versions where version='0.9.0') then '0.9.0' else null end,
    'checked_at',now(),
    'account',account,
    'checks',checks,
    'ready',not exists(
      select 1
      from jsonb_array_elements(checks) x
      where coalesce((x->>'ok')::boolean,false)=false
    )
  );
end;
$$;

revoke all on function public.tf_release_readiness() from public, anon;
grant execute on function public.tf_release_readiness() to authenticated;

commit;
