-- Site-owned Guide only. No provider key, owner password or live verifier belongs here.
create schema mdlxdcc_guide_private;
revoke all on schema mdlxdcc_guide_private from public;
grant usage on schema mdlxdcc_guide_private to anon, authenticated;

create table mdlxdcc_guide_private.config (
 id boolean primary key default true check (id),
 server_key_sha256 text not null check (server_key_sha256 ~ '^[a-f0-9]{64}$')
);
alter table mdlxdcc_guide_private.config enable row level security;
create policy config_verifier_read on mdlxdcc_guide_private.config for select to anon, authenticated using (true);
grant select on mdlxdcc_guide_private.config to anon, authenticated;

create function mdlxdcc_guide_private.server_allowed() returns boolean
language sql stable security invoker set search_path = '' as $$
 select coalesce((select c.server_key_sha256 = encode(sha256(convert_to(
  coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-mdlxdcc-guide-key', ''), 'UTF8')), 'hex')
  from mdlxdcc_guide_private.config c where c.id), false)
$$;
revoke all on function mdlxdcc_guide_private.server_allowed() from public;
grant execute on function mdlxdcc_guide_private.server_allowed() to anon, authenticated;

create table mdlxdcc_guide_private.accounts (
 id uuid primary key,
 email text unique not null check (email = lower(btrim(email)) and length(email) <= 254),
 password_hash text not null check (password_hash ~ '^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$'),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table mdlxdcc_guide_private.monthly_budget (
 month text primary key check (month ~ '^\d{4}-\d{2}$'),
 spent_nanos bigint not null default 0 check (spent_nanos >= 0),
 reserved_nanos bigint not null default 0 check (reserved_nanos >= 0),
 limit_nanos bigint not null default 100000000000 check (limit_nanos = 100000000000),
 check (spent_nanos + reserved_nanos <= limit_nanos)
);
create table mdlxdcc_guide_private.calls (
 id uuid primary key,
 request_id uuid not null,
 user_id uuid not null references mdlxdcc_guide_private.accounts(id),
 month text not null references mdlxdcc_guide_private.monthly_budget(month),
 provider text not null check (provider in ('gpt','claude')),
 model text not null,
 reserved_nanos bigint not null check (reserved_nanos > 0),
 charged_nanos bigint not null default 0 check (charged_nanos >= 0),
 status text not null default 'reserved' check (status in ('reserved','settled','unknown')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index guide_calls_user_time on mdlxdcc_guide_private.calls(user_id, created_at);
create index guide_calls_month_status on mdlxdcc_guide_private.calls(month, status);
create index guide_calls_request on mdlxdcc_guide_private.calls(request_id);
do $$ declare t text; begin
 foreach t in array array['accounts','monthly_budget','calls'] loop
  execute format('alter table mdlxdcc_guide_private.%I enable row level security', t);
  execute format('create policy server_only on mdlxdcc_guide_private.%I to anon, authenticated using ((select mdlxdcc_guide_private.server_allowed())) with check ((select mdlxdcc_guide_private.server_allowed()))', t);
  execute format('grant select, insert, update on mdlxdcc_guide_private.%I to anon, authenticated', t);
 end loop;
end $$;

create function mdlxdcc_guide_private.service(action text, data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 m text := to_char(now() at time zone 'Europe/Ljubljana', 'YYYY-MM');
 b mdlxdcc_guide_private.monthly_budget%rowtype;
 c mdlxdcc_guide_private.calls%rowtype;
 a mdlxdcc_guide_private.accounts%rowtype;
 amount bigint;
 stale bigint;
 own bigint;
 questions bigint;
begin
 if not mdlxdcc_guide_private.server_allowed() then raise insufficient_privilege using message = 'Server authentication required'; end if;
 if action = 'account_create' then
  begin
   insert into mdlxdcc_guide_private.accounts(id,email,password_hash) values ((data->>'id')::uuid,data->>'email',data->>'password_hash');
  exception when unique_violation then return jsonb_build_object('error','ACCOUNT_EXISTS'); end;
  return jsonb_build_object('ok',true);
 elsif action = 'account_login' then
  select * into a from mdlxdcc_guide_private.accounts where email = data->>'email';
  if not found then return '{}'::jsonb; end if;
  return jsonb_build_object('id',a.id,'password_hash',a.password_hash,'active',a.active);
 elsif action = 'account_active' then
  return jsonb_build_object('active',exists(select 1 from mdlxdcc_guide_private.accounts where id=(data->>'id')::uuid and active));
 end if;
 if action not in ('reserve','settle','stats') then raise invalid_parameter_value using message = 'Unknown action'; end if;
 if action = 'settle' then
  select * into c from mdlxdcc_guide_private.calls where id = (data->>'id')::uuid;
  if not found then return jsonb_build_object('error','UNKNOWN_RESERVATION'); end if;
  m := c.month;
 else
  if not exists(select 1 from mdlxdcc_guide_private.accounts where id = (data->>'user_id')::uuid and active) then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 end if;
 insert into mdlxdcc_guide_private.monthly_budget(month) values (m) on conflict do nothing;
 -- Every accounting mutation takes this same lock first, including concurrent tool rounds.
 select * into b from mdlxdcc_guide_private.monthly_budget where month = m for update;
 -- An interrupted/unknown provider call may have been billed. Never free its hold on a timeout.
 with old as (
  update mdlxdcc_guide_private.calls set status='unknown',charged_nanos=reserved_nanos,finished_at=now()
  where month=m and status='reserved' and created_at < now() - interval '2 minutes'
  returning reserved_nanos
 ) select coalesce(sum(reserved_nanos),0) into stale from old;
 if stale > 0 then
  update mdlxdcc_guide_private.monthly_budget set spent_nanos=spent_nanos+stale,reserved_nanos=reserved_nanos-stale where month=m returning * into b;
 end if;
 if action = 'reserve' then
  select * into c from mdlxdcc_guide_private.calls where id=(data->>'id')::uuid;
  if found then
   if c.user_id <> (data->>'user_id')::uuid or c.request_id <> (data->>'request_id')::uuid then raise invalid_parameter_value; end if;
   return jsonb_build_object('ok',true,'id',c.id);
  end if;
  amount := (data->>'amount')::bigint;
  if amount <= 0 or amount > b.limit_nanos then return jsonb_build_object('error','MONTHLY_LIMIT'); end if;
  if not exists(select 1 from mdlxdcc_guide_private.calls where user_id=(data->>'user_id')::uuid and request_id=(data->>'request_id')::uuid) then
   select count(distinct request_id) into questions from mdlxdcc_guide_private.calls where user_id=(data->>'user_id')::uuid and created_at >= now() - interval '1 minute';
   if questions >= 8 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  end if;
  if b.spent_nanos + b.reserved_nanos + amount > b.limit_nanos then return jsonb_build_object('error','MONTHLY_LIMIT'); end if;
  insert into mdlxdcc_guide_private.calls(id,request_id,user_id,month,provider,model,reserved_nanos)
  values ((data->>'id')::uuid,(data->>'request_id')::uuid,(data->>'user_id')::uuid,m,data->>'provider',data->>'model',amount);
  update mdlxdcc_guide_private.monthly_budget set reserved_nanos=reserved_nanos+amount where month=m;
 elsif action = 'settle' then
  select * into c from mdlxdcc_guide_private.calls where id=(data->>'id')::uuid for update;
  if c.status <> 'reserved' then return jsonb_build_object('ok',true,'status',c.status); end if;
  amount := greatest(0, (data->>'amount')::bigint);
  if amount > c.reserved_nanos then
   -- Pricing anomalies stop the visitor pool immediately; owner access stays separate.
   update mdlxdcc_guide_private.monthly_budget set reserved_nanos=reserved_nanos-c.reserved_nanos,spent_nanos=limit_nanos-reserved_nanos+c.reserved_nanos where month=m;
   update mdlxdcc_guide_private.calls set status='unknown',charged_nanos=amount,finished_at=now() where id=c.id;
   return jsonb_build_object('error','PRICING_MISMATCH');
  end if;
  update mdlxdcc_guide_private.monthly_budget set spent_nanos=spent_nanos+amount,reserved_nanos=reserved_nanos-c.reserved_nanos where month=m;
  update mdlxdcc_guide_private.calls set status=case when coalesce((data->>'unknown')::boolean,false) then 'unknown' else 'settled' end,charged_nanos=amount,finished_at=now() where id=c.id;
 elsif action = 'stats' then
  select coalesce(sum(charged_nanos),0),count(distinct request_id) into own,questions from mdlxdcc_guide_private.calls where month=m and user_id=(data->>'user_id')::uuid;
  return jsonb_build_object('exempt',false,'month',m,'spent',b.spent_nanos/1e9,'reserved',b.reserved_nanos/1e9,'limit',b.limit_nanos/1e9,'remaining',(b.limit_nanos-b.spent_nanos-b.reserved_nanos)/1e9,'own_spent',own/1e9,'questions',questions);
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function mdlxdcc_guide_private.service(text,jsonb) from public;
grant execute on function mdlxdcc_guide_private.service(text,jsonb) to anon, authenticated;
create function public.mdlxdcc_guide(action text, data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select mdlxdcc_guide_private.service(action, data)
$$;
revoke all on function public.mdlxdcc_guide(text,jsonb) from public;
grant execute on function public.mdlxdcc_guide(text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
