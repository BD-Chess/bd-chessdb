-- Private OmniCPQ knowledge and transactional 24-hour / USD 1 invitations.
-- Reuses the existing Guide server verifier; no credential is stored here.
create schema if not exists omnicpq_private;
revoke all on schema omnicpq_private from public;
grant usage on schema omnicpq_private to anon, authenticated;

create table omnicpq_private.demo_grants (
 id uuid primary key,
 token_hash text unique not null check (token_hash ~ '^[a-f0-9]{64}$'),
 ip_hash text check (ip_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default now(),
 activation_deadline timestamptz not null default now() + interval '24 hours',
 claimed_at timestamptz, expires_at timestamptz,
 active boolean not null default true,
 spent_nanos bigint not null default 0 check (spent_nanos >= 0),
 reserved_nanos bigint not null default 0 check (reserved_nanos >= 0),
 limit_nanos bigint not null default 1000000000 check (limit_nanos = 1000000000),
 check (spent_nanos + reserved_nanos <= limit_nanos),
 check ((claimed_at is null and expires_at is null and ip_hash is null) or
        (claimed_at is not null and expires_at = claimed_at + interval '24 hours' and ip_hash is not null))
);
create index omni_demo_ip on omnicpq_private.demo_grants(ip_hash);
create table omnicpq_private.calls (
 id uuid primary key,
 demo_id uuid not null references omnicpq_private.demo_grants(id),
 request_id uuid not null,
 reserved_nanos bigint not null check (reserved_nanos > 0),
 charged_nanos bigint not null default 0 check (charged_nanos >= 0),
 status text not null default 'reserved' check (status in ('reserved','settled','unknown')),
 created_at timestamptz not null default now(), finished_at timestamptz,
 unique (demo_id, request_id)
);
create index omni_calls_time on omnicpq_private.calls(demo_id, created_at);
create table omnicpq_private.knowledge (
 id text not null, part integer not null check (part >= 0),
 payload text not null,
 raw_sha256 text not null check (raw_sha256 ~ '^[a-f0-9]{64}$'),
 primary key (id, part)
);
do $$ declare t text; begin
 foreach t in array array['demo_grants','calls','knowledge'] loop
  execute format('alter table omnicpq_private.%I enable row level security',t);
  execute format('create policy server_only on omnicpq_private.%I to anon, authenticated using ((select mdlxdcc_guide_private.server_allowed())) with check ((select mdlxdcc_guide_private.server_allowed()))',t);
  execute format('grant select, insert, update on omnicpq_private.%I to anon, authenticated',t);
 end loop;
end $$;

create function omnicpq_private.usage(g omnicpq_private.demo_grants) returns jsonb
language sql immutable security invoker set search_path = '' as $$
 select jsonb_build_object('id',g.id,'active',g.active,'claimed_at',g.claimed_at,'expires_at',g.expires_at,
  'limit',g.limit_nanos/1e9,'spent',g.spent_nanos/1e9,'reserved',g.reserved_nanos/1e9,
  'remaining',(g.limit_nanos-g.spent_nanos-g.reserved_nanos)/1e9,'accounting','conservative_upper_bound')
$$;
revoke all on function omnicpq_private.usage(omnicpq_private.demo_grants) from public;
grant execute on function omnicpq_private.usage(omnicpq_private.demo_grants) to anon, authenticated;

create function omnicpq_private.service(action text, data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 g omnicpq_private.demo_grants%rowtype;
 c omnicpq_private.calls%rowtype;
 amount bigint; stale bigint; questions bigint;
begin
 if not mdlxdcc_guide_private.server_allowed() then raise insufficient_privilege using message='Server authentication required'; end if;
 if action='storage_status' then
  return (select jsonb_build_object('parts',count(*),'encoded_bytes',coalesce(sum(octet_length(k.payload)),0),'sha256',min(k.raw_sha256)) from omnicpq_private.knowledge k where k.id='v15');
 elsif action='knowledge' then
  return (select jsonb_build_object('encoding','gzip-base64','payload',string_agg(k.payload,'' order by k.part),'sha256',min(k.raw_sha256))
          from omnicpq_private.knowledge k where k.id='v15');
 elsif action='create' then
  insert into omnicpq_private.demo_grants(id,token_hash) values ((data->>'id')::uuid,data->>'token_hash');
  return jsonb_build_object('ok',true);
 elsif action='list' then
  return coalesce((select jsonb_agg(omnicpq_private.usage(d) order by d.issued_at desc)
                   from (select * from omnicpq_private.demo_grants order by issued_at desc limit 50) d),'[]'::jsonb);
 elsif action='claim' then
  select * into g from omnicpq_private.demo_grants where token_hash=data->>'token_hash' for update;
  if not found then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 elsif action='settle' then
  select * into c from omnicpq_private.calls where id=(data->>'id')::uuid and demo_id=(data->>'demo_id')::uuid;
  if not found then return jsonb_build_object('error','UNKNOWN_RESERVATION'); end if;
  select * into g from omnicpq_private.demo_grants where id=c.demo_id for update;
 else
  select * into g from omnicpq_private.demo_grants where id=(data->>'id')::uuid and action in ('check','revoke')
   or id=(data->>'demo_id')::uuid and action='reserve' for update;
  if not found then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 end if;
 if action='revoke' then
  update omnicpq_private.demo_grants set active=false where id=g.id returning * into g;
  return omnicpq_private.usage(g);
 end if;
 if action <> 'settle' then
  if not g.active then return jsonb_build_object('error','DEMO_REVOKED'); end if;
  if (g.claimed_at is null and g.activation_deadline <= now()) or g.expires_at <= now() then return jsonb_build_object('error','DEMO_EXPIRED'); end if;
  if coalesce(data->>'ip_hash','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
  if g.ip_hash is not null and g.ip_hash <> data->>'ip_hash' then return jsonb_build_object('error','DEMO_IP_CHANGED'); end if;
  if action='claim' and g.claimed_at is null then
   update omnicpq_private.demo_grants set claimed_at=now(),expires_at=now()+interval '24 hours',ip_hash=data->>'ip_hash' where id=g.id returning * into g;
  elsif g.claimed_at is null then return jsonb_build_object('error','AUTH_REQUIRED'); end if;
 end if;
 -- Take the grant lock before any call lock in every accounting operation.
 with old as (
  update omnicpq_private.calls set status='unknown',charged_nanos=reserved_nanos,finished_at=now()
  where demo_id=g.id and status='reserved' and created_at<now()-interval '2 minutes' returning reserved_nanos
 ) select coalesce(sum(reserved_nanos),0) into stale from old;
 if stale>0 then
  update omnicpq_private.demo_grants set spent_nanos=spent_nanos+stale,reserved_nanos=reserved_nanos-stale where id=g.id returning * into g;
 end if;
 if action='reserve' then
  if exists(select 1 from omnicpq_private.calls where demo_id=g.id and request_id=(data->>'request_id')::uuid) then return jsonb_build_object('error','DUPLICATE_REQUEST'); end if;
  if exists(select 1 from omnicpq_private.calls where demo_id=g.id and status='reserved') then return jsonb_build_object('error','REQUEST_IN_PROGRESS'); end if;
  select count(*) into questions from omnicpq_private.calls where demo_id=g.id and created_at>=now()-interval '1 minute';
  if questions>=8 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  amount := (data->>'amount')::bigint;
  if amount is null or amount<=0 or g.spent_nanos+g.reserved_nanos+amount>g.limit_nanos then return jsonb_build_object('error','DEMO_LIMIT'); end if;
  insert into omnicpq_private.calls(id,demo_id,request_id,reserved_nanos) values ((data->>'id')::uuid,g.id,(data->>'request_id')::uuid,amount);
  update omnicpq_private.demo_grants set reserved_nanos=reserved_nanos+amount where id=g.id returning * into g;
 elsif action='settle' then
  select * into c from omnicpq_private.calls where id=c.id for update;
  if c.status<>'reserved' then return omnicpq_private.usage(g); end if;
  amount := (data->>'amount')::bigint;
  if amount is null or amount<0 then return jsonb_build_object('error','INVALID_CHARGE'); end if;
  if amount>c.reserved_nanos then
   update omnicpq_private.calls set status='unknown',charged_nanos=amount,finished_at=now() where id=c.id;
   update omnicpq_private.demo_grants set active=false,spent_nanos=limit_nanos-reserved_nanos+c.reserved_nanos,reserved_nanos=reserved_nanos-c.reserved_nanos where id=g.id;
   return jsonb_build_object('error','PRICING_MISMATCH');
  end if;
  update omnicpq_private.calls set status=case when coalesce((data->>'unknown')::boolean,false) then 'unknown' else 'settled' end,charged_nanos=amount,finished_at=now() where id=c.id;
  update omnicpq_private.demo_grants set spent_nanos=spent_nanos+amount,reserved_nanos=reserved_nanos-c.reserved_nanos where id=g.id returning * into g;
 elsif action not in ('claim','check') then raise invalid_parameter_value using message='Unknown action';
 end if;
 return omnicpq_private.usage(g);
end $$;
revoke all on function omnicpq_private.service(text,jsonb) from public;
grant execute on function omnicpq_private.service(text,jsonb) to anon, authenticated;
create function public.omnicpq_runtime(action text,data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select omnicpq_private.service(action,data) $$;
revoke all on function public.omnicpq_runtime(text,jsonb) from public;
grant execute on function public.omnicpq_runtime(text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
