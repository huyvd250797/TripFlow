-- TripFlow V2.13.0 — additive upgrade after V2.12.0, no reset.
begin;
alter table public.trip_members add column if not exists can_close_settlement boolean not null default false;
alter table public.trip_invitations add column if not exists can_close_settlement boolean not null default false;
create table if not exists public.trip_settlements(trip_id uuid primary key references public.trips(id),id uuid generated always as (trip_id) stored,revision bigint not null default 1,closed_at timestamptz,closed_by uuid references auth.users(id));
create table if not exists public.settlement_entries(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id),kind text not null check(kind in ('transfer','reversal','close','reopen')),
 from_id uuid references public.trip_participants(id),to_id uuid references public.trip_participants(id),amount bigint not null default 0 check(amount between 0 and 1000000000000),
 reverses_id uuid unique references public.settlement_entries(id),occurred_on date not null,note text not null default '' check(length(note)<=2000),
 receipt_url text not null default '' check(length(receipt_url)<=2000 and (receipt_url='' or receipt_url ~ '^https://[^[:space:]]+$')),actor_id uuid references auth.users(id),created_at timestamptz not null default now(),
 check(kind not in ('transfer','reversal') or (from_id is not null and to_id is not null and from_id<>to_id and amount>0)));
create index if not exists settlement_budget_expenses on public.expenses(trip_id,budget_id) where deleted_at is null;
create index if not exists settlement_entries_trip on public.settlement_entries(trip_id,created_at,id);
do $$declare t text;begin foreach t in array array['trip_settlements','settlement_entries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('drop policy if exists settlement_read on public.%I',t);
 execute format('create policy settlement_read on public.%I for select to authenticated using(private.trip_role(trip_id) is not null)',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('drop trigger if exists settlement_audit on public.%I',t);
 execute format('create trigger settlement_audit after insert or update on public.%I for each row execute function private.audit_change()',t);end loop;end$$;
create or replace function private.tf_settlement_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare t uuid:=case when tg_op='DELETE' then old.trip_id else new.trip_id end;
begin
 perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 if exists(select 1 from public.trip_settlements where trip_id=t and closed_at is not null) then raise exception 'SETTLEMENT_CLOSED';end if;
 if tg_table_name='trip_participants' and tg_op='UPDATE' then
 if new.deleted_at is not null and old.deleted_at is null and (exists(select 1 from public.settlement_entries where trip_id=t and (from_id=new.id or to_id=new.id)) or exists(select 1 from public.fund_entries where trip_id=t and participant_id=new.id) or exists(select 1 from public.expenses where trip_id=t and deleted_at is null and (payer_participant_id=new.id or (payer_participant_id is null and payer=old.name)))) then raise exception 'PARTICIPANT_HAS_SETTLEMENT';end if;end if;
 insert into public.trip_settlements(trip_id,revision) values(t,1) on conflict(trip_id) do update set revision=trip_settlements.revision+1;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
revoke all on function private.tf_settlement_guard() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['budget_items','expenses','trip_participants','trip_funds','fund_targets','fund_entries','settlement_entries'] loop execute format('drop trigger if exists settlement_finance_guard on public.%I',t);execute format('create trigger settlement_finance_guard before insert or update or delete on public.%I for each row execute function private.tf_settlement_guard()',t);end loop;end$$;
-- Largest remainder allocation, stable UUID tie-break. Deposits scale full agreed shares.
create or replace function private.tf_settlement_shares(t uuid,b public.budget_items,actual bigint) returns table(participant_id uuid,amount bigint) language sql stable security definer set search_path='' as $$
 with fixed as (select (x->>'participant_id')::uuid id,(x->>'amount')::numeric val from jsonb_array_elements(case when b.cost_sharing->>'mode'='fixed_remainder' then b.cost_sharing->'fixed' else '[]'::jsonb end) x),
 chosen as (select p.id from public.trip_participants p where p.trip_id=t and p.deleted_at is null and (b.cost_sharing->>'mode'='equal' or b.cost_sharing->'participants' ? p.id::text)),
 settings as (select greatest(b.amount,actual,1)::numeric total,coalesce((select sum(val) from fixed),0) fixed_total,(select count(*) from chosen) cnt),
 weights as (select id,sum(val) weight from (select id,val from fixed union all select c.id,floor((s.total-s.fixed_total)/nullif(s.cnt,0))+case when row_number() over(order by c.id)<=mod(s.total-s.fixed_total,nullif(s.cnt,0)) then 1 else 0 end from chosen c cross join settings s) x group by id),
 raw as (select id,actual*weight/(select sum(weight) from weights) val from weights where weight>0),
 rounded as (select id,floor(val)::bigint base,row_number() over(order by val-floor(val) desc,id) rank from raw)
 select id,base+case when rank<=actual-(select coalesce(sum(base),0) from rounded) then 1 else 0 end from rounded;
$$;
revoke all on function private.tf_settlement_shares(uuid,public.budget_items,bigint) from public,anon,authenticated;
create or replace function private.tf_settlement_snapshot(t uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.budget_items;e public.expenses;f public.fund_entries;x record;pid uuid;v bigint;r jsonb;rows jsonb:='{}';details jsonb:='[]';issues jsonb:='[]';budgets jsonb:='[]';advances jsonb:='[]';total bigint:=0;cash bigint:=private.tf_fund_balance(t);shares_total bigint:=0;unpaid bigint:=0;
begin
 for x in select id,name from public.trip_participants where trip_id=t and deleted_at is null order by id loop rows:=jsonb_set(rows,array[x.id::text],jsonb_build_object('id',x.id,'name',x.name,'share',0,'paid',0,'contributed',0,'returned',0,'reimbursed',0,'sent',0,'received',0,'balance',0));end loop;
 for e in select * from public.expenses where trip_id=t and deleted_at is null order by id loop
 v:=case when e.kind='refund' then -e.amount else e.amount end;total:=total+v;
 if e.payment_source='personal' then
 pid:=e.payer_participant_id;
 if pid is null then select case when count(*)=1 then min(id::text)::uuid else null end into pid from public.trip_participants where trip_id=t and deleted_at is null and btrim(name)=btrim(e.payer);end if;
 if pid is null or not rows ? pid::text then issues:=issues||jsonb_build_array(jsonb_build_object('code','MISSING_PAYER','id',e.id,'title',e.title,'message','Chọn lại người thanh toán cho khoản chi.'));
 else rows:=jsonb_set(rows,array[pid::text,'paid'],to_jsonb((rows->pid::text->>'paid')::bigint+v));details:=details||jsonb_build_array(jsonb_build_object('participant_id',pid,'kind','paid','title',e.title,'amount',v,'id',e.id));end if;end if;
 if e.budget_id is null or not exists(select 1 from public.budget_items where id=e.budget_id and trip_id=t and deleted_at is null) then issues:=issues||jsonb_build_array(jsonb_build_object('code','UNLINKED_EXPENSE','id',e.id,'title',e.title,'message','Liên kết với dự toán có cách chia để quyết toán.'));end if;
 end loop;
 for b in select * from public.budget_items where trip_id=t and deleted_at is null order by id loop
 select coalesce(sum(case when kind='refund' then -amount else amount end),0) into v from public.expenses where trip_id=t and budget_id=b.id and deleted_at is null;
 unpaid:=unpaid+greatest(0,b.amount-v);budgets:=budgets||jsonb_build_array(jsonb_build_object('id',b.id,'title',b.title,'planned',b.amount,'actual',v,'remaining',greatest(0,b.amount-v)));
 if v=0 then continue;end if;
 if b.cost_sharing is null or b.cost_sharing='null'::jsonb then issues:=issues||jsonb_build_array(jsonb_build_object('code','MISSING_SHARING','id',b.id,'title',b.title,'message','Khai báo cách chia trong Dự toán.'));continue;end if;
 if v<0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','NEGATIVE_ACTUAL','id',b.id,'title',b.title,'message','Hoàn tiền vượt số đã trả.'));continue;end if;
 begin
 perform private.tf_validate_cost_sharing(t,b.amount,b.cost_sharing);
 for x in select * from private.tf_settlement_shares(t,b,v) loop
 rows:=jsonb_set(rows,array[x.participant_id::text,'share'],to_jsonb((rows->x.participant_id::text->>'share')::bigint+x.amount));shares_total:=shares_total+x.amount;
 details:=details||jsonb_build_array(jsonb_build_object('participant_id',x.participant_id,'kind','share','title',b.title,'amount',x.amount,'id',b.id));end loop;
 exception when others then issues:=issues||jsonb_build_array(jsonb_build_object('code','INVALID_SHARING','id',b.id,'title',b.title,'message','Cách chia không hợp lệ; chọn lại trong Dự toán.'));end;
 end loop;
 for f in select a.* from public.fund_entries a where a.trip_id=t and a.kind<>'reversal' and not exists(select 1 from public.fund_entries z where z.reverses_id=a.id) order by a.id loop
 pid:=f.participant_id;
 if f.kind='reimbursement' then select coalesce(exp_src.payer_participant_id,(select case when count(*)=1 then min(p.id::text)::uuid else null end from public.trip_participants p where p.trip_id=t and p.deleted_at is null and btrim(p.name)=btrim(exp_src.payer))) into pid from public.expenses exp_src where exp_src.id=f.expense_id;end if;
 if pid is null or not rows ? pid::text then issues:=issues||jsonb_build_array(jsonb_build_object('code','MISSING_FUND_PERSON','id',f.id,'title','Giao dịch quỹ','message','Người liên quan giao dịch quỹ không còn hợp lệ.'));
 else r:=rows->pid::text;
 if f.kind='contribution' then r:=jsonb_set(r,'{contributed}',to_jsonb((r->>'contributed')::bigint+f.amount));elsif f.kind='return' then r:=jsonb_set(r,'{returned}',to_jsonb((r->>'returned')::bigint+f.amount));else r:=jsonb_set(r,'{reimbursed}',to_jsonb((r->>'reimbursed')::bigint+f.amount));end if;
 rows:=jsonb_set(rows,array[pid::text],r);details:=details||jsonb_build_array(jsonb_build_object('participant_id',pid,'kind',f.kind,'title',case f.kind when 'contribution' then 'Đóng quỹ' when 'return' then 'Trả quỹ' else 'Hoàn ứng' end,'amount',f.amount,'id',f.id));end if;end loop;
 for e in select * from public.expenses where trip_id=t and kind='payment' and payment_source='personal' and settlement_type='advance' and deleted_at is null order by id loop
 select e.amount-coalesce((select sum(amount) from public.expenses where refund_of=e.id and deleted_at is null),0)-coalesce((select sum(a.amount) from public.fund_entries a where a.expense_id=e.id and a.kind='reimbursement' and not exists(select 1 from public.fund_entries z where z.reverses_id=a.id)),0) into v;
 if v>0 then advances:=advances||jsonb_build_array(jsonb_build_object('id',e.id,'title',e.title,'payer',e.payer,'remaining',v));end if;end loop;
 for x in select a.* from public.settlement_entries a where a.trip_id=t and a.kind='transfer' and not exists(select 1 from public.settlement_entries z where z.reverses_id=a.id) order by a.id loop
 if not rows ? x.from_id::text or not rows ? x.to_id::text then issues:=issues||jsonb_build_array(jsonb_build_object('code','MISSING_TRANSFER_PERSON','id',x.id,'title','Chuyển tiền','message','Người chuyển/nhận không còn hợp lệ.'));continue;end if;
 rows:=jsonb_set(rows,array[x.from_id::text,'sent'],to_jsonb((rows->x.from_id::text->>'sent')::bigint+x.amount));rows:=jsonb_set(rows,array[x.to_id::text,'received'],to_jsonb((rows->x.to_id::text->>'received')::bigint+x.amount));
 details:=details||jsonb_build_array(jsonb_build_object('participant_id',x.from_id,'kind','sent','title','Chuyển cho '||(rows->x.to_id::text->>'name'),'amount',x.amount,'id',x.id),jsonb_build_object('participant_id',x.to_id,'kind','received','title','Nhận từ '||(rows->x.from_id::text->>'name'),'amount',x.amount,'id',x.id));end loop;
 for x in select key,value from jsonb_each(rows) loop r:=x.value;v:=(r->>'paid')::bigint+(r->>'contributed')::bigint-(r->>'returned')::bigint-(r->>'reimbursed')::bigint+(r->>'sent')::bigint-(r->>'received')::bigint-(r->>'share')::bigint;rows:=jsonb_set(rows,array[x.key,'balance'],to_jsonb(v));end loop;
 if cash<0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','NEGATIVE_FUND','title','Quỹ','message','Số dư quỹ âm; kiểm tra giao dịch.'));end if;
 if shares_total<>total then issues:=issues||jsonb_build_array(jsonb_build_object('code','UNALLOCATED','title','Tổng phân bổ','message','Thực chi chưa được phân bổ đủ.'));end if;
 if coalesce((select sum((value->>'balance')::bigint) from jsonb_each(rows)),0)<>cash then issues:=issues||jsonb_build_array(jsonb_build_object('code','UNBALANCED','title','Đối chiếu','message','Số dư thành viên chưa khớp số dư quỹ.'));end if;
 if abs(total)>9007199254740991 or abs(cash)>9007199254740991 or abs(unpaid)>9007199254740991 or exists(select 1 from jsonb_each(rows) rr cross join lateral jsonb_each(rr.value) metric where metric.key in ('share','paid','contributed','returned','reimbursed','sent','received','balance') and abs((metric.value::text)::numeric)>9007199254740991) then raise exception 'SETTLEMENT_LIMIT';end if;
 return jsonb_build_object('revision',coalesce((select revision from public.trip_settlements where trip_id=t),0),'closed_at',(select closed_at from public.trip_settlements where trip_id=t),'can_close',private.tf_has_trip_permission(t,'can_close_settlement'),
 'rows',coalesce((select jsonb_agg(value order by value->>'name',key) from jsonb_each(rows)),'[]'::jsonb),'details',details,'issues',issues,'actual',total,'allocated',shares_total,'fund_balance',cash,'unpaid',unpaid,'budgets',budgets,'advances',advances,
 'fund_history',coalesce((select jsonb_agg(to_jsonb(fh) order by fh.created_at desc,fh.id) from public.fund_entries fh where fh.trip_id=t),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id) from public.settlement_entries h where h.trip_id=t),'[]'::jsonb),'generated_at',now());
end;$$;
revoke all on function private.tf_settlement_snapshot(uuid) from public,anon,authenticated;
create or replace function public.tf_settlement_snapshot(target_trip uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.trip_role(target_trip) is null then raise exception 'FORBIDDEN';end if;
 if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_trip::text,1));return private.tf_settlement_snapshot(target_trip);
end;$$;
revoke all on function public.tf_settlement_snapshot(uuid) from public,anon;grant execute on function public.tf_settlement_snapshot(uuid) to authenticated;
create or replace function private.tf_has_trip_permission(t uuid,permission_name text) returns boolean language sql stable security definer set search_path='' as $$
 select case when private.trip_role(t) is null then false when private.trip_role(t)='owner' then permission_name in ('can_invite','can_change_roles','can_revoke_access','can_delete_trip','can_close_budget','can_close_settlement')
 else coalesce((select case permission_name when 'can_invite' then m.can_invite when 'can_change_roles' then m.can_change_roles when 'can_revoke_access' then m.can_revoke_access when 'can_delete_trip' then m.can_delete_trip when 'can_close_budget' then m.can_close_budget when 'can_close_settlement' then m.can_close_settlement else false end from public.trip_members m where m.trip_id=t and m.user_id=auth.uid()),false) end;
$$;
create or replace function public.tf_trip_permissions(target_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.trip_role(target_trip) is null then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('can_invite',private.tf_has_trip_permission(target_trip,'can_invite'),'can_change_roles',private.tf_has_trip_permission(target_trip,'can_change_roles'),'can_revoke_access',private.tf_has_trip_permission(target_trip,'can_revoke_access'),'can_delete_trip',private.tf_has_trip_permission(target_trip,'can_delete_trip'),'can_close_budget',private.tf_has_trip_permission(target_trip,'can_close_budget'),'can_close_settlement',private.tf_has_trip_permission(target_trip,'can_close_settlement'));
end;$$;
-- Preserve sixth permission through invitation/role editing; old clients omit it safely.
do $$begin if to_regprocedure('public.tf_mutate_v2120(jsonb)') is null then alter function public.tf_mutate(jsonb) rename to tf_mutate_v2120;end if;end$$;
revoke all on function public.tf_mutate_v2120(jsonb) from public,anon,authenticated;
create or replace function public.tf_mutate(req jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(req->>'tripId')::uuid;u uuid:=auth.uid();op uuid:=(req->>'operationId')::uuid;r jsonb;receipt private.mutation_receipts;old_flag boolean;rid uuid;
begin
 if req->>'entity' not in ('member','invitation') then return public.tf_mutate_v2120(req);end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));
 if req->>'action'='accept' then select trip_id into t from public.trip_invitations where token=(req->'data'->>'token')::uuid;end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 if req->>'action'<>'accept' and private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(req::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 if req->'data' ? 'can_close_settlement' and req->>'action' in ('create','update') and private.trip_role(t)<>'owner' then
 old_flag:=false;
 if req->>'action'='update' and req->>'entity'='member' then select can_close_settlement into old_flag from public.trip_members where id=(req->>'id')::uuid and trip_id=t;end if;
 if coalesce((req->'data'->>'can_close_settlement')::boolean,false) is distinct from coalesce(old_flag,false) then raise exception 'PERMISSION_GRANT_OWNER_ONLY';end if;end if;
 r:=public.tf_mutate_v2120(req);rid:=(r->>'id')::uuid;
 if req->'data' ? 'can_close_settlement' and req->>'action' in ('create','update') then
 if req->>'entity'='member' then update public.trip_members set can_close_settlement=(req->'data'->>'can_close_settlement')::boolean where id=rid and trip_id=t returning to_jsonb(trip_members.*) into r;
 else update public.trip_invitations set can_close_settlement=(req->'data'->>'can_close_settlement')::boolean where id=rid and trip_id=t returning to_jsonb(trip_invitations.*) into r;end if;
 elsif req->>'action'='accept' then
 update public.trip_members m set can_close_settlement=i.can_close_settlement from public.trip_invitations i where i.token=(req->'data'->>'token')::uuid and i.trip_id=m.trip_id and m.user_id=u;
 end if;
 update private.mutation_receipts set result=r where user_id=u and operation_id=op;return r;
end;$$;
revoke all on function public.tf_mutate(jsonb) from public,anon;grant execute on function public.tf_mutate(jsonb) to authenticated;
create or replace function public.tf_settlement_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tripId')::uuid;u uuid:=auth.uid();op uuid:=(p->>'operationId')::uuid;a text:=p->>'action';d jsonb:=p->'data';s jsonb;r jsonb;receipt private.mutation_receipts;old public.settlement_entries;sender jsonb;receiver jsonb;pid uuid;fid uuid;tid uuid;amt bigint;reason text:=btrim(coalesce(d->>'note',''));v bigint;is_closed boolean;
begin
 if u is null or private.trip_role(t) is null then raise exception 'FORBIDDEN';end if;
 if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED';end if;
 if private.trip_role(t) not in ('owner','editor') then raise exception 'READ_ONLY';end if;
 if op is null or jsonb_typeof(d) is distinct from 'object' or octet_length(p::text)>16000 then raise exception 'INVALID_DATA';end if;
 if a in ('close','reopen') and not private.tf_has_trip_permission(t,'can_close_settlement') then raise exception 'PERMISSION_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||op::text,0));perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 select * into receipt from private.mutation_receipts where user_id=u and operation_id=op;
 if found then if receipt.request_hash<>md5(p::text) then raise exception 'OPERATION_REUSED';end if;return receipt.result;end if;
 s:=private.tf_settlement_snapshot(t);is_closed:=s->>'closed_at' is not null;
 if (p->>'revision')::bigint is distinct from (s->>'revision')::bigint then raise exception 'STALE_VERSION';end if;
 if length(reason)>2000 then raise exception 'INVALID_DATA';end if;
 if a='reopen' then
 if not is_closed or reason='' then raise exception 'REASON_REQUIRED';end if;
 update public.trip_settlements set closed_at=null,closed_by=null where trip_id=t;
 insert into public.settlement_entries(trip_id,kind,occurred_on,note,actor_id) values(t,'reopen',current_date,reason,u);
 else
 if is_closed then raise exception 'SETTLEMENT_CLOSED';end if;
 if a='reversal' then
 if reason='' then raise exception 'REASON_REQUIRED';end if;
 select * into old from public.settlement_entries where id=(d->>'reverses_id')::uuid and trip_id=t and kind='transfer';
 if old.id is null or exists(select 1 from public.settlement_entries where reverses_id=old.id) then raise exception 'INVALID_REVERSAL';end if;
 insert into public.settlement_entries(trip_id,kind,from_id,to_id,amount,reverses_id,occurred_on,note,actor_id) values(t,'reversal',old.from_id,old.to_id,old.amount,old.id,current_date,reason,u);
 elsif a='close' then
 if jsonb_array_length(s->'issues')>0 or (s->>'fund_balance')::bigint<>0 or (s->>'unpaid')::bigint>0 or exists(select 1 from jsonb_array_elements(s->'rows') x where (x->>'balance')::bigint<>0) then raise exception 'SETTLEMENT_NOT_READY';end if;
 insert into public.settlement_entries(trip_id,kind,occurred_on,note,actor_id) values(t,'close',current_date,reason,u);
 update public.trip_settlements set closed_at=now(),closed_by=u where trip_id=t;
 elsif a in ('transfer','fund_return','reimbursement') then
 if jsonb_array_length(s->'issues')>0 then raise exception 'SETTLEMENT_INCOMPLETE';end if;
 if (d->>'amount')::numeric is null or (d->>'amount')::numeric<>trunc((d->>'amount')::numeric) or (d->>'amount')::numeric not between 1 and 1000000000000 then raise exception 'INVALID_AMOUNT';end if;amt:=(d->>'amount')::bigint;
 if (d->>'occurred_on')::date is null then raise exception 'INVALID_DATA';end if;
 if a='transfer' then
 fid:=(d->>'from_id')::uuid;tid:=(d->>'to_id')::uuid;
 select value into sender from jsonb_array_elements(s->'rows') where value->>'id'=fid::text;
 select value into receiver from jsonb_array_elements(s->'rows') where value->>'id'=tid::text;
 if sender is null or receiver is null or fid=tid then raise exception 'INVALID_PARTICIPANT';end if;
 if amt>-(sender->>'balance')::bigint or amt>(receiver->>'balance')::bigint then raise exception 'TRANSFER_EXCEEDS_BALANCE';end if;
 insert into public.settlement_entries(trip_id,kind,from_id,to_id,amount,occurred_on,note,receipt_url,actor_id) values(t,'transfer',fid,tid,amt,(d->>'occurred_on')::date,reason,coalesce(d->>'receipt_url',''),u);
 else
 if a='reimbursement' then
 select coalesce(e.payer_participant_id,(select case when count(*)=1 then min(x.id::text)::uuid else null end from public.trip_participants x where x.trip_id=t and x.deleted_at is null and btrim(x.name)=btrim(e.payer))) into pid from public.expenses e where e.id=(d->>'expense_id')::uuid and e.trip_id=t;
 else pid:=(d->>'participant_id')::uuid;end if;
 select value into receiver from jsonb_array_elements(s->'rows') where value->>'id'=pid::text;
 if receiver is null then raise exception 'INVALID_PARTICIPANT';end if;
 if amt>(receiver->>'balance')::bigint then raise exception 'TRANSFER_EXCEEDS_BALANCE';end if;
 perform public.tf_fund_mutate(jsonb_build_object('tripId',t,'operationId',gen_random_uuid(),'action','entry','data',d||jsonb_build_object('kind',case when a='fund_return' then 'return' else 'reimbursement' end,'reverses_id','','participant_id',case when a='fund_return' then pid::text else '' end,'expense_id',case when a='reimbursement' then d->>'expense_id' else '' end,'method','Quyết toán')));
 end if;
 else raise exception 'INVALID_ACTION';end if;end if;
 r:=private.tf_settlement_snapshot(t);
 insert into private.mutation_receipts(user_id,operation_id,trip_id,request_hash,result) values(u,op,t,md5(p::text),r);return r;
end;$$;
revoke all on function public.tf_settlement_mutate(jsonb) from public,anon;grant execute on function public.tf_settlement_mutate(jsonb) to authenticated;

-- Extend the existing complete backup, preserving all previous fields.
create or replace function public.tf_create_trip_backup(target_trip uuid, backup_title text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  tr public.trips;
  p jsonb;
  b public.trip_backups;
  keep_days integer;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_trip::text,1));
  select * into tr from public.trips where id=target_trip and deleted_at is null;
  if tr.id is null then raise exception 'NOT_FOUND'; end if;
  if tr.owner_id<>u then raise exception 'OWNER_ONLY'; end if;
  select backup_days into keep_days from public.tf_retention_policy where id=1;

  p:=jsonb_build_object(
    'format','tripflow-recovery-backup',
    'format_version',1,
    'created_at',now(),
    'source_trip_id',target_trip,
    'trip',to_jsonb(tr),
    'items',coalesce((select jsonb_agg(to_jsonb(x) order by x.start_at,x.id) from public.itinerary_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.budget_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'settlement_state',(select to_jsonb(x) from public.trip_settlements x where x.trip_id=target_trip),
    'settlement_entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.settlement_entries x where x.trip_id=target_trip),'[]'::jsonb),
    'fund', (select to_jsonb(f) from public.trip_funds f where f.trip_id=target_trip),
    'fund_targets',coalesce((select jsonb_agg(to_jsonb(f)) from public.fund_targets f where f.trip_id=target_trip),'[]'::jsonb),
    'fund_entries',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at,f.id) from public.fund_entries f where f.trip_id=target_trip),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.spent_on,x.created_at,x.id) from public.expenses x where x.trip_id=target_trip),'[]'::jsonb),
    'media',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.media_links x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'wishes',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_wishes x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_checklist_items x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'contacts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_contacts x where x.trip_id=target_trip and x.deleted_at is null),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from public.trip_participants x where x.trip_id=target_trip),'[]'::jsonb),
    'snapshots',coalesce((select jsonb_agg(jsonb_build_object('title',x.title,'data',x.data,'created_at',x.created_at) order by x.created_at,x.id) from public.budget_snapshots x where x.trip_id=target_trip),'[]'::jsonb),
    'live_events',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at,x.id) from public.itinerary_events x where x.trip_id=target_trip),'[]'::jsonb),
    'audit_archive',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (select * from public.audit_logs where trip_id=target_trip order by created_at desc limit 1000) x),'[]'::jsonb)
  );

  insert into public.trip_backups(source_trip_id,owner_id,title,payload,checksum,size_bytes,expires_at)
  values(
    target_trip,u,
    coalesce(nullif(btrim(backup_title),''),tr.name||' · Backup '||to_char(now(),'DD/MM/YYYY HH24:MI')),
    p,md5(p::text),octet_length(p::text),now()+make_interval(days=>keep_days)
  ) returning * into b;

  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(target_trip,u,'trip_backups',b.id,'BACKUP_CREATE',jsonb_build_object('title',b.title,'checksum',b.checksum,'size_bytes',b.size_bytes,'expires_at',b.expires_at));

  return jsonb_build_object('id',b.id,'source_trip_id',b.source_trip_id,'title',b.title,'checksum',b.checksum,'size_bytes',b.size_bytes,'created_at',b.created_at,'expires_at',b.expires_at);
end;
$$;


create or replace function public.tf_restore_trip_backup(backup_id uuid, restored_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid();
  b public.trip_backups;
  p jsonb;
  t jsonb;
  r jsonb;
  new_trip uuid:=gen_random_uuid();
  new_id uuid;
  item_map jsonb:='{}'::jsonb;
  budget_map jsonb:='{}'::jsonb;
  expense_map jsonb:='{}'::jsonb;
  participant_map jsonb:='{}'::jsonb;
  fund_map jsonb:='{}'::jsonb;
  settlement_map jsonb:='{}'::jsonb;
  old_id text;
  old_ref text;
  mapped text;
begin
  if u is null then raise exception 'UNAUTHORIZED'; end if;
  if coalesce(public.tf_account_state()->>'status','active')<>'active' then raise exception 'ACCOUNT_DEACTIVATED'; end if;
  select * into b from public.trip_backups where id=backup_id and owner_id=u;
  if b.id is null then raise exception 'NOT_FOUND'; end if;
  p:=b.payload; t:=p->'trip';
  if p->>'format' <> 'tripflow-recovery-backup' or coalesce((p->>'format_version')::int,0)<>1 then raise exception 'BACKUP_FORMAT_UNSUPPORTED'; end if;
  if md5(p::text)<>b.checksum then raise exception 'BACKUP_CHECKSUM_MISMATCH'; end if;

  insert into public.trips(id,owner_id,name,destination,start_date,end_date,timezone,people,status,note)
  values(
    new_trip,u,
    left(coalesce(nullif(btrim(restored_name),''),coalesce(t->>'name','Chuyến đi')||' (Khôi phục)'),160),
    left(coalesce(t->>'destination',''),300),
    (t->>'start_date')::date,(t->>'end_date')::date,coalesce(t->>'timezone','Asia/Ho_Chi_Minh'),
    greatest(1,least(999,coalesce((t->>'people')::int,1))),'planning',left(coalesce(t->>'note',''),5000)
  );

  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); item_map:=item_map||jsonb_build_object(old_id,new_id::text);
    insert into public.itinerary_items(id,trip_id,title,location,start_at,end_at,status,map_url,note,checked_in_at,completed_at)
    values(new_id,new_trip,left(r->>'title',200),left(coalesce(r->>'location',''),300),(r->>'start_at')::timestamptz,(r->>'end_at')::timestamptz,
      case when r->>'status' in ('planned','active','done','skipped') then r->>'status' else 'planned' end,
      left(coalesce(r->>'map_url',''),3000),left(coalesce(r->>'note',''),5000),nullif(r->>'checked_in_at','')::timestamptz,nullif(r->>'completed_at','')::timestamptz);
  end loop;

  -- Restore metadata only after every itinerary ID has been mapped.
  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    update public.itinerary_items set time_mode=coalesce(r->>'time_mode','flexible'),earliest_at=(r->>'earliest_at')::timestamptz,latest_at=(r->>'latest_at')::timestamptz,
      travel_mode=coalesce(r->>'travel_mode','other'),travel_minutes=(r->>'travel_minutes')::integer,buffer_minutes=coalesce((r->>'buffer_minutes')::integer,0),leg_from_id=(item_map->>(r->>'leg_from_id'))::uuid
    where id=(item_map->>(r->>'id'))::uuid and trip_id=new_trip;
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'wishes','[]'::jsonb)) loop
    -- Restored trip may retain completed/skipped history referenced by a saved Plan B.
    insert into public.trip_wishes(id,trip_id,title,location,duration_minutes,map_url,note,backup_for_id)
    values(gen_random_uuid(),new_trip,r->>'title',coalesce(r->>'location',''),(r->>'duration_minutes')::integer,coalesce(r->>'map_url',''),coalesce(r->>'note',''),(item_map->>(r->>'backup_for_id'))::uuid);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'participants','[]'::jsonb)) loop
    new_id:=gen_random_uuid();participant_map:=participant_map||jsonb_build_object(r->>'id',new_id::text);
    insert into public.trip_participants(id,trip_id,name,note,deleted_at,age_group,family_group,needs_note)
    values(new_id,new_trip,left(r->>'name',160),left(coalesce(r->>'note',''),5000),nullif(r->>'deleted_at','')::timestamptz,coalesce(r->>'age_group','adult'),coalesce(r->>'family_group',''),coalesce(r->>'needs_note',''));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'checklist','[]'::jsonb)) loop
    perform private.tf_preparation_write(new_trip,'checklist','create',gen_random_uuid(),null,r||jsonb_build_object('assignee_id',participant_map->>(r->>'assignee_id')));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'contacts','[]'::jsonb)) loop
    perform private.tf_preparation_write(new_trip,'contact','create',gen_random_uuid(),null,r);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'budgets','[]'::jsonb)) loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); budget_map:=budget_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.budget_items(id,trip_id,item_id,title,category,quantity,unit_price,note,cost_sharing)
    values(new_id,new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'category',(r->>'quantity')::numeric,(r->>'unit_price')::bigint,left(coalesce(r->>'note',''),5000),private.tf_remap_cost_sharing(r->'cost_sharing',participant_map));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='payment' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at,payer_participant_id,settlement_type)
    values(new_id,new_trip,nullif(mapped,'')::uuid,null,'payment',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz,(participant_map->>(r->>'payer_participant_id'))::uuid,coalesce(r->>'settlement_type','advance'));
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'expenses','[]'::jsonb)) where value->>'kind'='refund' loop
    old_id:=r->>'id'; new_id:=gen_random_uuid(); expense_map:=expense_map||jsonb_build_object(old_id,new_id::text);
    old_ref:=nullif(r->>'budget_id',''); mapped:=case when old_ref is null then null else budget_map->>old_ref end;
    insert into public.expenses(id,trip_id,budget_id,refund_of,kind,title,category,amount,spent_on,payer,note,receipt_url,payment_source,deleted_at,payer_participant_id,settlement_type)
    values(new_id,new_trip,nullif(mapped,'')::uuid,nullif(expense_map->>(r->>'refund_of'),'')::uuid,'refund',left(r->>'title',200),r->>'category',(r->>'amount')::bigint,(r->>'spent_on')::date,left(coalesce(r->>'payer',''),160),left(coalesce(r->>'note',''),5000),left(coalesce(r->>'receipt_url',''),3000),coalesce(r->>'payment_source','personal'),nullif(r->>'deleted_at','')::timestamptz,(participant_map->>(r->>'payer_participant_id'))::uuid,coalesce(r->>'settlement_type','advance'));
  end loop;

  for r in select value from jsonb_array_elements(coalesce(p->'media','[]'::jsonb)) loop
    old_ref:=nullif(r->>'item_id',''); mapped:=case when old_ref is null then null else item_map->>old_ref end;
    insert into public.media_links(id,trip_id,item_id,title,kind,url,note,taken_on,is_highlight,is_cover,story_order)
    values(
      gen_random_uuid(),new_trip,nullif(mapped,'')::uuid,left(r->>'title',200),r->>'kind',left(r->>'url',3000),left(coalesce(r->>'note',''),5000),
      nullif(r->>'taken_on','')::date,coalesce((r->>'is_highlight')::boolean,false),coalesce((r->>'is_cover')::boolean,false),greatest(coalesce((r->>'story_order')::int,0),0)
    );
  end loop;



  if jsonb_typeof(p->'fund')='object' then
    insert into public.trip_funds(id,trip_id,keeper,note) values(new_trip,new_trip,p->'fund'->>'keeper',coalesce(p->'fund'->>'note',''));
  end if;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_targets','[]'::jsonb)) loop
    insert into public.fund_targets(id,trip_id,participant_id,amount,due_on) values(gen_random_uuid(),new_trip,(participant_map->>(r->>'participant_id'))::uuid,(r->>'amount')::bigint,nullif(r->>'due_on','')::date);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_entries','[]'::jsonb)) loop
    fund_map:=fund_map||jsonb_build_object(r->>'id',gen_random_uuid()::text);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'fund_entries','[]'::jsonb)) order by (value->>'kind'='reversal') loop
    insert into public.fund_entries(id,trip_id,kind,participant_id,expense_id,reverses_id,amount,occurred_on,note,method,receipt_url,created_at)
    values((fund_map->>(r->>'id'))::uuid,new_trip,r->>'kind',(participant_map->>(r->>'participant_id'))::uuid,(expense_map->>(r->>'expense_id'))::uuid,(fund_map->>(r->>'reverses_id'))::uuid,(r->>'amount')::bigint,(r->>'occurred_on')::date,coalesce(r->>'note',''),coalesce(r->>'method',''),coalesce(r->>'receipt_url',''),(r->>'created_at')::timestamptz);
  end loop;
  perform private.tf_fund_check(new_trip);


  for r in select value from jsonb_array_elements(coalesce(p->'settlement_entries','[]'::jsonb)) loop
    settlement_map:=settlement_map||jsonb_build_object(r->>'id',gen_random_uuid()::text);
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p->'settlement_entries','[]'::jsonb)) order by (value->>'kind'='reversal') loop
    insert into public.settlement_entries(id,trip_id,kind,from_id,to_id,amount,reverses_id,occurred_on,note,receipt_url,actor_id,created_at)
    values((settlement_map->>(r->>'id'))::uuid,new_trip,r->>'kind',(participant_map->>(r->>'from_id'))::uuid,(participant_map->>(r->>'to_id'))::uuid,(r->>'amount')::bigint,(settlement_map->>(r->>'reverses_id'))::uuid,(r->>'occurred_on')::date,coalesce(r->>'note',''),coalesce(r->>'receipt_url',''),nullif(r->>'actor_id','')::uuid,(r->>'created_at')::timestamptz);
  end loop;
  if p->'settlement_state'->>'closed_at' is not null then
    update public.trip_settlements set closed_at=(p->'settlement_state'->>'closed_at')::timestamptz,closed_by=nullif(p->'settlement_state'->>'closed_by','')::uuid where trip_id=new_trip;
  end if;

  for r in select value from jsonb_array_elements(coalesce(p->'snapshots','[]'::jsonb)) loop
    insert into public.budget_snapshots(trip_id,title,data,created_by)
    values(new_trip,left(coalesce(r->>'title','Dự toán khôi phục'),200),coalesce(r->'data','[]'::jsonb),u);
  end loop;

  insert into public.audit_logs(trip_id,actor_id,entity,record_id,action,after_data)
  values(new_trip,u,'trip_backups',backup_id,'RESTORE_AS_COPY',jsonb_build_object('source_trip_id',b.source_trip_id,'checksum',b.checksum));

  return jsonb_build_object('trip_id',new_trip,'backup_id',b.id,'name',(select name from public.trips where id=new_trip));
end;
$$;


-- Planning templates retain wall-clock constraints and remap route legs.
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
        'time_mode',i.time_mode,'travel_mode',i.travel_mode,'travel_minutes',i.travel_minutes,'buffer_minutes',i.buffer_minutes,'leg_from_id',i.leg_from_id,
        'earliest_offset_minutes',case when i.earliest_at is null then null else round(extract(epoch from ((i.earliest_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int end,
        'latest_offset_minutes',case when i.latest_at is null then null else round(extract(epoch from ((i.latest_at at time zone tr.timezone)-tr.start_date::timestamp))/60)::int end,
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

  for r in select value from jsonb_array_elements(coalesce(p->'items','[]'::jsonb)) loop
    update public.itinerary_items set time_mode=coalesce(r->>'time_mode','flexible'),travel_mode=coalesce(r->>'travel_mode','other'),travel_minutes=(r->>'travel_minutes')::integer,buffer_minutes=coalesce((r->>'buffer_minutes')::integer,0),leg_from_id=(item_map->>(r->>'leg_from_id'))::uuid,
      earliest_at=case when r->>'earliest_offset_minutes' is null then null else (new_start_date::timestamp+make_interval(mins=>(r->>'earliest_offset_minutes')::int)) at time zone zone_name end,
      latest_at=case when r->>'latest_offset_minutes' is null then null else (new_start_date::timestamp+make_interval(mins=>(r->>'latest_offset_minutes')::int)) at time zone zone_name end
    where id=(item_map->>(r->>'id'))::uuid and trip_id=new_trip;
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



insert into public.tf_schema_versions(version,migration_name) values('2.13.0','202611020001_v2130_group_settlement.sql') on conflict(version) do nothing;
do $$begin if to_regprocedure('public.tf_release_readiness_v2120()') is null then alter function public.tf_release_readiness() rename to tf_release_readiness_v2120;end if;end$$;
revoke all on function public.tf_release_readiness_v2120() from public,anon,authenticated;
create or replace function public.tf_release_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;ok boolean;begin r:=public.tf_release_readiness_v2120();select count(*)=2 and bool_and(relrowsecurity) into ok from pg_class where oid in (to_regclass('public.trip_settlements'),to_regclass('public.settlement_entries'));return r||jsonb_build_object('app_version','2.13.0','database_version','2.13.0','ready',(r->>'ready')::boolean and ok,'checks',(r->'checks')||jsonb_build_array(jsonb_build_object('key','group_settlement','label','Group Expenses & Settlement V2.13.0','ok',ok)));end;$$;
revoke all on function public.tf_release_readiness() from public,anon;grant execute on function public.tf_release_readiness() to authenticated;
commit;
