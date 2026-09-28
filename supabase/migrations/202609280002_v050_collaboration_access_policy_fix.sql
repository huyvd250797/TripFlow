begin;

-- V0.5.0 hotfix carried forward into V0.6.0.
-- Authenticated users can read only access events targeted at their own active account.
drop policy if exists target_reads_access_events on public.trip_access_events;
create policy target_reads_access_events
on public.trip_access_events
for select
to authenticated
using (
  target_user_id = auth.uid()
  and coalesce(public.tf_account_state()->>'status', 'active') = 'active'
);

grant select on public.trip_access_events to authenticated;

commit;
