-- GAME-LOG-R1. Reuse the existing unexposed Guide schema/server credential.
-- No service role, new secret, exposed table or SECURITY DEFINER function.
begin;
create table mdlxdcc_guide_private.game_sessions (
 id uuid primary key,
 actor_key text check (actor_key ~ '^[a-f0-9]{64}$'),
 slug text check (slug in ('dayton1903','faraday1831','_fixture')),
 owner boolean,
 consent boolean,
 development boolean,
 last_seq bigint not null default 0 check (last_seq >= 0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz,
 check (deleted_at is not null or (actor_key is not null and slug is not null and owner is not null and consent is true and development is not null))
);
create index game_sessions_recent on mdlxdcc_guide_private.game_sessions(updated_at desc) where deleted_at is null;
create table mdlxdcc_guide_private.game_events (
 game_session_id uuid not null references mdlxdcc_guide_private.game_sessions(id),
 seq bigint not null check (seq > 0),
 at timestamptz not null default clock_timestamp(),
 kind text not null check (kind in ('player_message','agent_response','open_step','set_mode','mark_result','fair_play','cost','error')),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 160000),
 primary key (game_session_id, seq)
);
alter table mdlxdcc_guide_private.game_sessions enable row level security;
alter table mdlxdcc_guide_private.game_events enable row level security;
create policy server_only on mdlxdcc_guide_private.game_sessions to anon, authenticated
 using ((select mdlxdcc_guide_private.server_allowed())) with check ((select mdlxdcc_guide_private.server_allowed()));
create policy server_only on mdlxdcc_guide_private.game_events to anon, authenticated
 using ((select mdlxdcc_guide_private.server_allowed())) with check ((select mdlxdcc_guide_private.server_allowed()));
revoke all on mdlxdcc_guide_private.game_sessions, mdlxdcc_guide_private.game_events from public, anon, authenticated;
grant select, insert, update on mdlxdcc_guide_private.game_sessions to anon, authenticated;
grant select, insert, delete on mdlxdcc_guide_private.game_events to anon, authenticated;

create function mdlxdcc_guide_private.game_log_service(action text, data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 s mdlxdcc_guide_private.game_sessions%rowtype;
 e jsonb;
 items jsonb;
 cursor_seq bigint;
begin
 if not mdlxdcc_guide_private.server_allowed() then raise insufficient_privilege using message = 'Server authentication required'; end if;
 if action = 'game_log_start' then
  -- Defense in depth: public sessions never exist without explicit consent.
  if coalesce((data->>'consent')::boolean,false) is not true then return jsonb_build_object('ok',true,'logging',false); end if;
  insert into mdlxdcc_guide_private.game_sessions(id,actor_key,slug,owner,consent,development)
   values ((data->>'id')::uuid,data->>'actor_key',data->>'slug',(data->>'owner')::boolean,true,(data->>'development')::boolean)
   on conflict (id) do nothing;
  select * into s from mdlxdcc_guide_private.game_sessions where id=(data->>'id')::uuid for update;
  if s.deleted_at is not null or s.actor_key is distinct from data->>'actor_key' or s.slug is distinct from data->>'slug'
   or s.owner is distinct from (data->>'owner')::boolean or s.development is distinct from (data->>'development')::boolean then
   raise insufficient_privilege using message = 'Session unavailable';
  end if;
  return jsonb_build_object('ok',true,'id',s.id);
 elsif action = 'game_log_recent' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc,q.game_session_id),'[]'::jsonb) into items from (
   select id as game_session_id,slug,owner,development,last_seq,created_at,updated_at
   from mdlxdcc_guide_private.game_sessions where deleted_at is null order by updated_at desc,id limit 30
  ) q;
  return jsonb_build_object('sessions',items);
 elsif action = 'game_log_read' then
  cursor_seq := coalesce((data->>'since')::bigint,0);
  if cursor_seq < 0 then raise invalid_parameter_value; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.seq),'[]'::jsonb) into items from (
   select ev.game_session_id,ev.seq,ev.at,ev.kind,ev.payload from mdlxdcc_guide_private.game_events ev
   join mdlxdcc_guide_private.game_sessions sess on sess.id=ev.game_session_id and sess.deleted_at is null
   where ev.game_session_id=(data->>'id')::uuid and ev.seq>cursor_seq order by ev.seq limit 20
  ) q;
  return jsonb_build_object('events',items,'since',cursor_seq);
 elsif action in ('game_log_append','game_log_delete') then
  -- Same lock serializes sequence assignment, append and erasure.
  select * into s from mdlxdcc_guide_private.game_sessions where id=(data->>'id')::uuid for update;
  if action = 'game_log_delete' then
   if found and s.deleted_at is null and s.actor_key = data->>'actor_key' then
    delete from mdlxdcc_guide_private.game_events where game_session_id=s.id;
    -- Keep only an opaque tombstone: stale/in-flight requests cannot recreate a deleted log.
    update mdlxdcc_guide_private.game_sessions set actor_key=null,slug=null,owner=null,consent=null,development=null,
     last_seq=0,created_at=clock_timestamp(),updated_at=clock_timestamp(),deleted_at=clock_timestamp() where id=s.id;
   end if;
   return jsonb_build_object('ok',true);
  end if;
  if not found or s.deleted_at is not null or s.actor_key is distinct from data->>'actor_key' or s.consent is not true then
   raise insufficient_privilege using message = 'Session unavailable';
  end if;
  if jsonb_typeof(data->'events') is distinct from 'array' or jsonb_array_length(data->'events') > 100 then raise invalid_parameter_value; end if;
  for e in select value from jsonb_array_elements(data->'events') loop
   if s.development and e->>'kind' = 'mark_result' then raise invalid_parameter_value; end if;
   s.last_seq := s.last_seq + 1;
   insert into mdlxdcc_guide_private.game_events(game_session_id,seq,kind,payload) values (s.id,s.last_seq,e->>'kind',e->'payload');
  end loop;
  update mdlxdcc_guide_private.game_sessions set last_seq=s.last_seq,updated_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('ok',true,'seq',s.last_seq);
 end if;
 raise invalid_parameter_value using message = 'Unknown log action';
end $$;
revoke all on function mdlxdcc_guide_private.game_log_service(text,jsonb) from public;
grant execute on function mdlxdcc_guide_private.game_log_service(text,jsonb) to anon, authenticated;
-- Extend only the small public dispatcher; original Guide service stays unchanged.
create or replace function public.mdlxdcc_guide(action text, data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
 select case when action like 'game_log_%' then mdlxdcc_guide_private.game_log_service(action,data)
  else mdlxdcc_guide_private.service(action,data) end
$$;
revoke all on function public.mdlxdcc_guide(text,jsonb) from public;
grant execute on function public.mdlxdcc_guide(text,jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
