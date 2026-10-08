-- Sổ tiền V2. Run once through Supabase SQL Editor/migrations as the project owner.
-- RPC writer is deliberately not a table owner, has no login and cannot bypass RLS.
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='sotien_writer') then create role sotien_writer nologin nobypassrls; end if;
 if exists(select 1 from pg_roles where rolname='sotien_writer' and (rolsuper or rolbypassrls or rolcanlogin)) then raise exception 'Unsafe existing sotien_writer role'; end if;
end $$;
grant usage on schema public, auth to sotien_writer;
grant execute on function auth.uid() to sotien_writer;
create table public.sync_clock (
 user_id uuid primary key references auth.users(id), version bigint not null default 0 check(version>=0),
 initialized boolean not null default false, bootstrap_id uuid
);
create table public.sync_changes (
 user_id uuid not null references auth.users(id), version bigint not null,
 entity_type text not null, entity_id uuid not null, payload jsonb not null, mutation_id uuid not null,
 primary key(user_id,version)
);
create table public.sync_receipts (
 user_id uuid not null references auth.users(id), mutation_id uuid not null, request_hash text not null,
 result jsonb not null, primary key(user_id,mutation_id)
);
create table public.sync_staging (
 user_id uuid not null references auth.users(id), bootstrap_id uuid not null,
 entity_type text not null, entity_id uuid not null, payload jsonb not null,
 primary key(user_id,bootstrap_id,entity_type,entity_id)
);
create table public.accounts (
 user_id uuid not null references auth.users(id), id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
 sync_version bigint not null check(sync_version>0), primary key(user_id,id),
 check((payload->>'id')::uuid=id),
 name text generated always as (payload->>'name') stored not null check(length(btrim(name)) between 1 and 80),
 type text generated always as (payload->>'type') stored not null check(type in ('cash','bank','ewallet','credit','other')),
 currency text generated always as (payload->>'currency') stored not null check(currency='VND'),
 initial_balance numeric generated always as ((payload->>'initialBalance')::numeric) stored not null check(initial_balance=trunc(initial_balance) and abs(initial_balance)<=1000000000000)
);
create table public.categories (
 user_id uuid not null references auth.users(id), id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
 sync_version bigint not null check(sync_version>0), primary key(user_id,id),
 check((payload->>'id')::uuid=id),
 name text generated always as (payload->>'name') stored not null check(length(btrim(name)) between 1 and 80),
 type text generated always as (payload->>'type') stored not null check(type in ('income','expense')),
 check(coalesce(length(payload->>'icon'),0)<=30)
);
create table public.savings_goals (
 user_id uuid not null references auth.users(id), id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
 sync_version bigint not null check(sync_version>0), primary key(user_id,id),
 check((payload->>'id')::uuid=id),
 name text generated always as (payload->>'name') stored not null check(length(btrim(name)) between 1 and 80),
 target_amount numeric generated always as ((payload->>'targetAmount')::numeric) stored not null check(target_amount=trunc(target_amount) and target_amount between 1 and 1000000000000),
 current_amount numeric generated always as ((payload->>'currentAmount')::numeric) stored not null check(current_amount=trunc(current_amount) and current_amount between 0 and 1000000000000)
);
create table public.transactions (
 user_id uuid not null references auth.users(id), id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
 sync_version bigint not null check(sync_version>0), primary key(user_id,id),
 check((payload->>'id')::uuid=id),
 type text generated always as (payload->>'type') stored not null check(type in ('income','expense','transfer')),
 amount numeric generated always as ((payload->>'amount')::numeric) stored not null check(amount=trunc(amount) and amount between 1 and 1000000000000),
 account_id uuid generated always as ((payload->>'accountId')::uuid) stored not null,
 to_account_id uuid generated always as ((payload->>'toAccountId')::uuid) stored,
 category_id uuid generated always as ((payload->>'categoryId')::uuid) stored,
 date text generated always as (payload->>'date') stored not null,
 foreign key(user_id,account_id) references public.accounts(user_id,id),
 foreign key(user_id,to_account_id) references public.accounts(user_id,id),
 foreign key(user_id,category_id) references public.categories(user_id,id),
 check((type='transfer' and to_account_id is not null and account_id<>to_account_id and category_id is null) or (type<>'transfer' and to_account_id is null)),
 check(coalesce(length(payload->>'note'),0)<=500)
);
create table public.budgets (
 user_id uuid not null references auth.users(id), id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null, updated_at timestamptz not null, deleted_at timestamptz,
 sync_version bigint not null check(sync_version>0), primary key(user_id,id),
 check((payload->>'id')::uuid=id),
 amount numeric generated always as ((payload->>'amount')::numeric) stored not null check(amount=trunc(amount) and amount between 1 and 1000000000000),
 category_id uuid generated always as ((payload->>'categoryId')::uuid) stored,
 month text generated always as (payload->>'month') stored not null check(month ~ '^(19[0-9]{2}|[2-9][0-9]{3})-(0[1-9]|1[0-2])$'),
 period text generated always as (payload->>'period') stored not null check(period='monthly'),
 foreign key(user_id,category_id) references public.categories(user_id,id)
);
create unique index budgets_active_unique on public.budgets(user_id,month,category_id) nulls not distinct where deleted_at is null;
alter table public.accounts enable row level security;
alter table public.accounts force row level security;
create policy owner on public.accounts to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.accounts from public, anon, authenticated;
grant select,insert,update,delete on public.accounts to sotien_writer;
alter table public.categories enable row level security;
alter table public.categories force row level security;
create policy owner on public.categories to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.categories from public, anon, authenticated;
grant select,insert,update,delete on public.categories to sotien_writer;
alter table public.savings_goals enable row level security;
alter table public.savings_goals force row level security;
create policy owner on public.savings_goals to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.savings_goals from public, anon, authenticated;
grant select,insert,update,delete on public.savings_goals to sotien_writer;
alter table public.transactions enable row level security;
alter table public.transactions force row level security;
create policy owner on public.transactions to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.transactions from public, anon, authenticated;
grant select,insert,update,delete on public.transactions to sotien_writer;
alter table public.budgets enable row level security;
alter table public.budgets force row level security;
create policy owner on public.budgets to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.budgets from public, anon, authenticated;
grant select,insert,update,delete on public.budgets to sotien_writer;
alter table public.sync_clock enable row level security;
alter table public.sync_clock force row level security;
create policy owner on public.sync_clock to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.sync_clock from public, anon, authenticated;
grant select,insert,update,delete on public.sync_clock to sotien_writer;
alter table public.sync_changes enable row level security;
alter table public.sync_changes force row level security;
create policy owner on public.sync_changes to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.sync_changes from public, anon, authenticated;
grant select,insert,update,delete on public.sync_changes to sotien_writer;
alter table public.sync_receipts enable row level security;
alter table public.sync_receipts force row level security;
create policy owner on public.sync_receipts to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.sync_receipts from public, anon, authenticated;
grant select,insert,update,delete on public.sync_receipts to sotien_writer;
alter table public.sync_staging enable row level security;
alter table public.sync_staging force row level security;
create policy owner on public.sync_staging to authenticated, sotien_writer using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.sync_staging from public, anon, authenticated;
grant select,insert,update,delete on public.sync_staging to sotien_writer;
grant select on public.accounts to authenticated;
grant select on public.categories to authenticated;
grant select on public.savings_goals to authenticated;
grant select on public.transactions to authenticated;
grant select on public.budgets to authenticated;

-- Only fixed table names ever enter dynamic SQL. No client-provided owner is accepted.
create function public.sotien_table(kind text) returns text language sql immutable set search_path='' as $$
 select case kind when 'accounts' then 'accounts' when 'categories' then 'categories' when 'transactions' then 'transactions' when 'budgets' then 'budgets' when 'savingsGoals' then 'savings_goals' else null end
$$;
create function public.sotien_validate(kind text, p jsonb) returns void language plpgsql set search_path='' as $$
declare allowed text[]; k text; v text; d date;
begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>16384 then raise exception 'invalid payload' using errcode='22023'; end if;
 allowed := array['id','createdAt','updatedAt','deletedAt'] || case kind
 when 'accounts' then array['name','type','initialBalance','currency']
 when 'categories' then array['name','type','icon']
 when 'transactions' then array['type','amount','accountId','toAccountId','categoryId','date','note']
 when 'budgets' then array['categoryId','amount','period','month']
 when 'savingsGoals' then array['name','targetAmount','currentAmount','deadline'] else array[]::text[] end;
 if public.sotien_table(kind) is null then raise exception 'invalid entity' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p) loop
  if not k=any(allowed) then raise exception 'unknown field' using errcode='22023'; end if;
  if k in ('initialBalance','amount','targetAmount','currentAmount') then
   if jsonb_typeof(p->k)<>'number' then raise exception 'invalid money' using errcode='22023'; end if;
  elsif k<>'deletedAt' and jsonb_typeof(p->k)<>'string' then raise exception 'invalid field type' using errcode='22023'; end if;
 end loop;
 if not p ?& array['id','createdAt','updatedAt','deletedAt'] or (p->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid metadata' using errcode='22023'; end if;
 foreach k in array array['createdAt','updatedAt','deletedAt'] loop
  v:=p->>k;
  if v is not null then
   if v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' then raise exception 'invalid timestamp' using errcode='22023'; end if;
   perform v::timestamptz;
  elsif k<>'deletedAt' then raise exception 'missing timestamp' using errcode='22023'; end if;
 end loop;
 foreach k in array array['date','deadline'] loop
  if p ? k then
   v:=p->>k; d:=v::date;
   if v !~ '^(19[0-9]{2}|[2-9][0-9]{3})-\d{2}-\d{2}$' or to_char(d,'YYYY-MM-DD')<>v then raise exception 'invalid date' using errcode='22023'; end if;
  end if;
 end loop;
end $$;

-- Called only while holding the per-user clock lock, including all parent/child checks.
create function public.sotien_write(kind text, p jsonb, revision bigint) returns void language plpgsql set search_path='' as $$
declare u uuid:=auth.uid(); entity uuid:=(p->>'id')::uuid; live boolean:=p->>'deletedAt' is null; t text:=public.sotien_table(kind); parent_type text;
begin
 perform public.sotien_validate(kind,p);
 if kind='transactions' then
  if live and (not exists(select 1 from public.accounts where user_id=u and id=(p->>'accountId')::uuid and deleted_at is null)
   or (p ? 'toAccountId' and not exists(select 1 from public.accounts where user_id=u and id=(p->>'toAccountId')::uuid and deleted_at is null))) then raise exception 'parent unavailable' using errcode='23503'; end if;
  if p ? 'categoryId' then
   select type into parent_type from public.categories where user_id=u and id=(p->>'categoryId')::uuid and (not live or deleted_at is null);
   if parent_type is distinct from p->>'type' then raise exception 'category unavailable or wrong type' using errcode='23503'; end if;
  end if;
 elsif kind='budgets' and p ? 'categoryId' then
  if not exists(select 1 from public.categories where user_id=u and id=(p->>'categoryId')::uuid and type='expense' and (not live or deleted_at is null)) then raise exception 'category unavailable' using errcode='23503'; end if;
 elsif kind='accounts' and not live then
  if exists(select 1 from public.transactions where user_id=u and deleted_at is null and (account_id=entity or to_account_id=entity)) then raise exception 'account in use' using errcode='23503'; end if;
 elsif kind='categories' then
  if exists(select 1 from public.transactions where user_id=u and category_id=entity and ((type<>p->>'type') or (not live and deleted_at is null)))
   or exists(select 1 from public.budgets where user_id=u and category_id=entity and ((p->>'type'<>'expense') or (not live and deleted_at is null))) then raise exception 'category in use' using errcode='23503'; end if;
 end if;
 execute format('insert into public.%I(user_id,id,payload,created_at,updated_at,deleted_at,sync_version) values($1,$2,$3,$4,$5,$6,$7) on conflict(user_id,id) do update set payload=excluded.payload,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,sync_version=excluded.sync_version',t)
 using u,entity,p,(p->>'createdAt')::timestamptz,(p->>'updatedAt')::timestamptz,(p->>'deletedAt')::timestamptz,revision;
end $$;

create function public.sync_push(mutation_id uuid, entity_type text, payload jsonb, base_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t text:=public.sotien_table(entity_type); h text; receipt public.sync_receipts; old_payload jsonb; old_version bigint; rev bigint; result jsonb; entity uuid; ready boolean;
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 if t is null or mutation_id is null or payload is null then raise exception 'invalid request' using errcode='22023'; end if;
 entity:=(payload->>'id')::uuid;
 h:=encode(sha256(convert_to(jsonb_build_array(entity_type,payload,base_version)::text,'UTF8')),'hex');
 insert into public.sync_clock(user_id) values(u) on conflict do nothing;
 select initialized into ready from public.sync_clock where user_id=u for update;
 select * into receipt from public.sync_receipts r where r.user_id=u and r.mutation_id=sync_push.mutation_id;
 if found then
  if receipt.request_hash<>h then raise exception 'mutation reused with different content' using errcode='22023'; end if;
  return receipt.result;
 end if;
 if not ready then raise exception 'bootstrap required' using errcode='55000'; end if;
 execute format('select payload,sync_version from public.%I where user_id=$1 and id=$2',t) into old_payload,old_version using u,entity;
 if (old_version is not null and (base_version is null or old_version<>base_version::bigint)) or (old_version is null and base_version is not null) then
  result:=jsonb_build_object('status','conflict','payload',old_payload,'version',old_version::text);
 else
  begin
   if old_payload is not null and payload->>'createdAt' is distinct from old_payload->>'createdAt' then raise exception 'immutable creation time' using errcode='22023'; end if;
   update public.sync_clock set version=version+1 where user_id=u returning version into rev;
   perform public.sotien_write(entity_type,payload,rev);
   insert into public.sync_changes values(u,rev,entity_type,entity,payload,mutation_id);
   result:=jsonb_build_object('status','applied','payload',payload,'version',rev::text);
  exception when integrity_constraint_violation or data_exception then
   result:=jsonb_build_object('status','invalid','code',SQLSTATE);
  end;
 end if;
 insert into public.sync_receipts values(u,mutation_id,h,result);
 return result;
end $$;

create function public.sync_pull(after_version text default '0', page_limit integer default 200, upper_bound text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); hi bigint; ready boolean; changes jsonb; cursor_value bigint;
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 if after_version is null or page_limit is null or page_limit not between 1 and 500 or after_version::bigint<0 then raise exception 'invalid pagination' using errcode='22023'; end if;
 select version, initialized into hi,ready from public.sync_clock where user_id=u;
 hi:=least(coalesce(hi,0),coalesce(upper_bound::bigint,hi,0));
 if after_version::bigint>hi then raise exception 'cursor ahead of server' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('entityType',entity_type,'payload',payload,'version',version::text,'mutationId',mutation_id) order by version),'[]'::jsonb), max(version) into changes,cursor_value
 from (select * from public.sync_changes where user_id=u and version>after_version::bigint and version<=hi order by version limit page_limit) c;
 return jsonb_build_object('initialized',coalesce(ready,false),'upperBound',hi::text,'cursor',coalesce(cursor_value,after_version::bigint)::text,'changes',changes);
end $$;

-- Staging keeps uploads invisible until one atomic publish. Retrying batches is safe.
create function public.sync_stage(bootstrap_id uuid, records jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r jsonb; ready boolean; existing jsonb;
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 if bootstrap_id is null or records is null or jsonb_typeof(records)<>'array' or jsonb_array_length(records)>200 or octet_length(records::text)>2000000 then raise exception 'invalid batch' using errcode='22023'; end if;
 insert into public.sync_clock(user_id) values(u) on conflict do nothing;
 select initialized into ready from public.sync_clock where user_id=u for update;
 if ready then raise exception 'cloud already initialized' using errcode='55000'; end if;
 for r in select * from jsonb_array_elements(records) loop
  perform public.sotien_validate(r->>'entityType',r->'payload');
  select payload into existing from public.sync_staging s where s.user_id=u and s.bootstrap_id=sync_stage.bootstrap_id and s.entity_type=r->>'entityType' and s.entity_id=(r->'payload'->>'id')::uuid;
  if found and existing<>r->'payload' then raise exception 'immutable batch' using errcode='22023'; end if;
  insert into public.sync_staging values(u,bootstrap_id,r->>'entityType',(r->'payload'->>'id')::uuid,r->'payload') on conflict do nothing;
 end loop;
 if (select count(*) from public.sync_staging where user_id=u)>100000 then raise exception 'bootstrap too large' using errcode='22023'; end if;
end $$;

create function public.sync_initialize(bootstrap_id uuid, expected_count integer) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c public.sync_clock; r public.sync_staging; rev bigint;
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 if bootstrap_id is null or expected_count is null or expected_count not between 0 and 100000 then raise exception 'invalid bootstrap' using errcode='22023'; end if;
 insert into public.sync_clock(user_id) values(u) on conflict do nothing;
 select * into c from public.sync_clock where user_id=u for update;
 if c.initialized then
  if c.bootstrap_id=sync_initialize.bootstrap_id then return; end if;
  raise exception 'cloud already initialized' using errcode='55000';
 end if;
 if (select count(*) from public.sync_staging s where s.user_id=u and s.bootstrap_id=sync_initialize.bootstrap_id)<>expected_count then raise exception 'incomplete bootstrap' using errcode='22023'; end if;
 rev:=c.version;
 for r in select * from public.sync_staging s where s.user_id=u and s.bootstrap_id=sync_initialize.bootstrap_id order by case entity_type when 'accounts' then 0 when 'categories' then 1 when 'savingsGoals' then 2 when 'transactions' then 3 else 4 end, entity_id loop
  rev:=rev+1;
  perform public.sotien_write(r.entity_type,r.payload,rev);
  insert into public.sync_changes values(u,rev,r.entity_type,r.entity_id,r.payload,bootstrap_id);
 end loop;
 update public.sync_clock set version=rev, initialized=true, bootstrap_id=sync_initialize.bootstrap_id where user_id=u;
 delete from public.sync_staging where user_id=u;
end $$;
-- Ownership transfer also works for Supabase's non-superuser project administrator.
-- These migration-only privileges are removed after function ownership is assigned.
grant sotien_writer to current_user;
grant create on schema public to sotien_writer;
alter function public.sotien_table(text) owner to sotien_writer;
revoke all on function public.sotien_table(text) from public,anon,authenticated;
alter function public.sotien_validate(text,jsonb) owner to sotien_writer;
revoke all on function public.sotien_validate(text,jsonb) from public,anon,authenticated;
alter function public.sotien_write(text,jsonb,bigint) owner to sotien_writer;
revoke all on function public.sotien_write(text,jsonb,bigint) from public,anon,authenticated;
alter function public.sync_push(uuid,text,jsonb,text) owner to sotien_writer;
revoke all on function public.sync_push(uuid,text,jsonb,text) from public,anon,authenticated;
alter function public.sync_pull(text,integer,text) owner to sotien_writer;
revoke all on function public.sync_pull(text,integer,text) from public,anon,authenticated;
alter function public.sync_stage(uuid,jsonb) owner to sotien_writer;
revoke all on function public.sync_stage(uuid,jsonb) from public,anon,authenticated;
alter function public.sync_initialize(uuid,integer) owner to sotien_writer;
revoke all on function public.sync_initialize(uuid,integer) from public,anon,authenticated;
grant execute on function public.sync_push(uuid,text,jsonb,text) to authenticated;
grant execute on function public.sync_pull(text,integer,text) to authenticated;
grant execute on function public.sync_stage(uuid,jsonb) to authenticated;
grant execute on function public.sync_initialize(uuid,integer) to authenticated;
revoke create on schema public from sotien_writer;
revoke sotien_writer from current_user;
commit;
