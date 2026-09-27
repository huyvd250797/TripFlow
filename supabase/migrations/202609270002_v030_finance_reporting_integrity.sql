-- TripFlow V0.3.0 - Finance & Reporting Integrity
-- Run after 202609270001_v020_offline_master_admin.sql.
begin;

-- Snapshot metadata turns the first lock into a stable baseline and every later
-- lock into a revision. The JSON payload remains the immutable copy of budget
-- rows at the time the snapshot was created.
alter table public.budget_snapshots add column if not exists snapshot_no integer;
alter table public.budget_snapshots add column if not exists snapshot_kind text;
alter table public.budget_snapshots add column if not exists total_amount bigint;
alter table public.budget_snapshots add column if not exists item_count integer;

with ranked as (
  select id,
         row_number() over(partition by trip_id order by created_at,id)::integer as rn
  from public.budget_snapshots
)
update public.budget_snapshots s
set snapshot_no=r.rn,
    snapshot_kind=case when r.rn=1 then 'baseline' else 'revision' end,
    total_amount=coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(s.data) x),0),
    item_count=jsonb_array_length(s.data)
from ranked r
where r.id=s.id
  and (s.snapshot_no is null or s.snapshot_kind is null or s.total_amount is null or s.item_count is null);

alter table public.budget_snapshots alter column snapshot_no set not null;
alter table public.budget_snapshots alter column snapshot_kind set not null;
alter table public.budget_snapshots alter column total_amount set not null;
alter table public.budget_snapshots alter column item_count set not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='budget_snapshot_kind_chk') then
    alter table public.budget_snapshots add constraint budget_snapshot_kind_chk check(snapshot_kind in ('baseline','revision'));
  end if;
  if not exists(select 1 from pg_constraint where conname='budget_snapshot_amount_chk') then
    alter table public.budget_snapshots add constraint budget_snapshot_amount_chk check(total_amount>=0 and item_count>=0);
  end if;
end $$;
create unique index if not exists budget_snapshot_no_uq on public.budget_snapshots(trip_id,snapshot_no);
create index if not exists expense_refund_parent on public.expenses(trip_id,refund_of) where deleted_at is null and refund_of is not null;
create index if not exists budget_activity on public.budget_items(trip_id,item_id) where deleted_at is null;

create or replace function private.tf_snapshot_prepare() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(new.data) is distinct from 'array' then raise exception 'INVALID_SNAPSHOT'; end if;
  select coalesce(max(s.snapshot_no),0)+1 into new.snapshot_no
  from public.budget_snapshots s where s.trip_id=new.trip_id;
  new.snapshot_kind:=case when new.snapshot_no=1 then 'baseline' else 'revision' end;
  new.total_amount:=coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(new.data) x),0);
  new.item_count:=jsonb_array_length(new.data);
  return new;
end;
$$;
revoke all on function private.tf_snapshot_prepare() from public;

drop trigger if exists tf_snapshot_prepare on public.budget_snapshots;
create trigger tf_snapshot_prepare before insert on public.budget_snapshots
for each row execute function private.tf_snapshot_prepare();

create or replace function private.tf_snapshot_no_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  raise exception 'SNAPSHOT_IMMUTABLE';
end;
$$;
revoke all on function private.tf_snapshot_no_update() from public;
drop trigger if exists tf_snapshot_no_update on public.budget_snapshots;
create trigger tf_snapshot_no_update before update on public.budget_snapshots
for each row execute function private.tf_snapshot_no_update();

create or replace function public.tf_finance_report(target_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  baseline public.budget_snapshots;
  original_budget bigint:=0;
  current_budget bigint:=0;
  gross_payments bigint:=0;
  refunds bigint:=0;
  net_actual bigint:=0;
  unlinked_actual bigint:=0;
  issues jsonb:='[]'::jsonb;
  c integer;
  category_rows jsonb;
  day_rows jsonb;
  activity_rows jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not private.tf_account_active(auth.uid()) then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  if private.trip_role(target_trip) is null then raise exception 'FORBIDDEN'; end if;

  select * into baseline from public.budget_snapshots
  where trip_id=target_trip
  order by snapshot_no,created_at,id limit 1;

  if baseline.id is not null then original_budget:=baseline.total_amount;
  else issues:=issues||jsonb_build_array(jsonb_build_object('code','NO_BASELINE','count',1,'message','Chưa chốt dự toán gốc để làm mốc đối chiếu.'));
  end if;

  select coalesce(sum(amount),0) into current_budget from public.budget_items where trip_id=target_trip and deleted_at is null;
  select coalesce(sum(amount),0) into gross_payments from public.expenses where trip_id=target_trip and deleted_at is null and kind='payment';
  select coalesce(sum(amount),0) into refunds from public.expenses where trip_id=target_trip and deleted_at is null and kind='refund';
  net_actual:=gross_payments-refunds;
  select coalesce(sum(case when kind='refund' then -amount else amount end),0) into unlinked_actual
  from public.expenses where trip_id=target_trip and deleted_at is null and budget_id is null;

  select count(*) into c from (
    select p.id from public.expenses p
    join public.expenses r on r.refund_of=p.id and r.trip_id=p.trip_id and r.deleted_at is null
    where p.trip_id=target_trip and p.deleted_at is null and p.kind='payment'
    group by p.id,p.amount having sum(r.amount)>p.amount
  ) x;
  if c>0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','REFUND_EXCEEDED','count',c,'message','Có khoản hoàn tiền vượt số tiền của giao dịch gốc.')); end if;

  select count(*) into c
  from public.expenses r join public.expenses p on p.id=r.refund_of and p.trip_id=r.trip_id
  where r.trip_id=target_trip and r.deleted_at is null and r.kind='refund'
    and (p.deleted_at is not null or p.kind<>'payment' or r.category is distinct from p.category or r.budget_id is distinct from p.budget_id);
  if c>0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','REFUND_MISMATCH','count',c,'message','Có giao dịch hoàn tiền không còn khớp giao dịch gốc.')); end if;

  select count(*) into c
  from public.expenses e join public.budget_items b on b.id=e.budget_id and b.trip_id=e.trip_id
  where e.trip_id=target_trip and e.deleted_at is null and (b.deleted_at is not null or e.category is distinct from b.category);
  if c>0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','BUDGET_LINK_MISMATCH','count',c,'message','Có thực chi liên kết dự toán đã xóa hoặc sai nhóm chi phí.')); end if;

  select count(*) into c
  from public.budget_items b join public.itinerary_items i on i.id=b.item_id and i.trip_id=b.trip_id
  where b.trip_id=target_trip and b.deleted_at is null and i.deleted_at is not null;
  if c>0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','ACTIVITY_LINK_MISMATCH','count',c,'message','Có dự toán còn liên kết hoạt động đã xóa.')); end if;

  select count(*) into c
  from public.budget_snapshots s
  where s.trip_id=target_trip and
    (s.total_amount<>coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(s.data) x),0)
     or s.item_count<>jsonb_array_length(s.data));
  if c>0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','SNAPSHOT_MISMATCH','count',c,'message','Có snapshot dự toán không khớp dữ liệu đã chốt.')); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'category',cat,
    'original',coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(coalesce(baseline.data,'[]'::jsonb)) x where x->>'category'=cat),0),
    'current',coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.category=cat),0),
    'payments',coalesce((select sum(e.amount) from public.expenses e where e.trip_id=target_trip and e.deleted_at is null and e.kind='payment' and e.category=cat),0),
    'refunds',coalesce((select sum(e.amount) from public.expenses e where e.trip_id=target_trip and e.deleted_at is null and e.kind='refund' and e.category=cat),0),
    'actual',coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end) from public.expenses e where e.trip_id=target_trip and e.deleted_at is null and e.category=cat),0),
    'variance',coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.category=cat),0)-coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end) from public.expenses e where e.trip_id=target_trip and e.deleted_at is null and e.category=cat),0)
  )),'[]'::jsonb) into category_rows
  from unnest(array['Di chuyển','Lưu trú','Ăn uống','Tham quan','Mua sắm','Khác']) as c(cat);

  select coalesce(jsonb_agg(to_jsonb(d) order by d.day),'[]'::jsonb) into day_rows
  from (
    select spent_on as day,
      coalesce(sum(amount) filter (where kind='payment'),0)::bigint as payments,
      coalesce(sum(amount) filter (where kind='refund'),0)::bigint as refunds,
      coalesce(sum(case when kind='refund' then -amount else amount end),0)::bigint as actual
    from public.expenses where trip_id=target_trip and deleted_at is null
    group by spent_on
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object(
    'item_id',a.item_id,
    'title',a.title,
    'current_budget',a.current_budget,
    'actual',a.actual,
    'variance',a.variance
  ) order by a.sort_key,a.title),'[]'::jsonb) into activity_rows
  from (
    select 0 as sort_key,i.id as item_id,i.title,
      coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.item_id=i.id),0)::bigint as current_budget,
      coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end)
                from public.expenses e join public.budget_items b on b.id=e.budget_id and b.trip_id=e.trip_id
                where e.trip_id=target_trip and e.deleted_at is null and b.deleted_at is null and b.item_id=i.id),0)::bigint as actual,
      coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.item_id=i.id),0)::bigint-
      coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end)
                from public.expenses e join public.budget_items b on b.id=e.budget_id and b.trip_id=e.trip_id
                where e.trip_id=target_trip and e.deleted_at is null and b.deleted_at is null and b.item_id=i.id),0)::bigint as variance
    from public.itinerary_items i where i.trip_id=target_trip and i.deleted_at is null
    union all
    select 1,null::uuid,'Ngoài hoạt động / chưa phân bổ',
      coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.item_id is null),0)::bigint,
      coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end)
                from public.expenses e left join public.budget_items b on b.id=e.budget_id and b.trip_id=e.trip_id and b.deleted_at is null
                where e.trip_id=target_trip and e.deleted_at is null and (e.budget_id is null or b.item_id is null)),0)::bigint,
      coalesce((select sum(b.amount) from public.budget_items b where b.trip_id=target_trip and b.deleted_at is null and b.item_id is null),0)::bigint-
      coalesce((select sum(case when e.kind='refund' then -e.amount else e.amount end)
                from public.expenses e left join public.budget_items b on b.id=e.budget_id and b.trip_id=e.trip_id and b.deleted_at is null
                where e.trip_id=target_trip and e.deleted_at is null and (e.budget_id is null or b.item_id is null)),0)::bigint
  ) a;

  return jsonb_build_object(
    'generated_at',now(),
    'baseline_snapshot_id',baseline.id,
    'baseline_snapshot_no',baseline.snapshot_no,
    'totals',jsonb_build_object(
      'original_budget',original_budget,
      'current_budget',current_budget,
      'gross_payments',gross_payments,
      'refunds',refunds,
      'net_actual',net_actual,
      'unlinked_actual',unlinked_actual,
      'current_variance',current_budget-net_actual,
      'original_variance',case when baseline.id is null then null else original_budget-net_actual end
    ),
    'categories',category_rows,
    'days',day_rows,
    'activities',activity_rows,
    'integrity',jsonb_build_object(
      'status',case when jsonb_array_length(issues)=0 then 'ok' else 'warning' end,
      'issue_count',jsonb_array_length(issues),
      'issues',issues
    )
  );
end;
$$;
revoke all on function public.tf_finance_report(uuid) from public,anon;
grant execute on function public.tf_finance_report(uuid) to authenticated;

commit;
