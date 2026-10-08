-- Run only in a dedicated Supabase project for this fictional demo.
create table if not exists public.demo_rooms (
  id uuid primary key,
  run integer not null default 1,
  version integer not null default 0,
  events jsonb not null default '[]'::jsonb,
  constraint demo_rooms_events_array check (jsonb_typeof(events) = 'array')
);

create table if not exists public.demo_sessions (
  id uuid primary key,
  room_id uuid not null references public.demo_rooms(id) on delete cascade,
  token_hash text not null unique,
  role text check (role in ('portfolio', 'lending', 'broker_a', 'broker_b', 'custodian')),
  kicked boolean not null default false,
  last_seen_at timestamptz not null default now()
);

create unique index if not exists demo_one_active_role_per_room
  on public.demo_sessions(room_id, role) where role is not null and kicked = false;
create index if not exists demo_sessions_room_id_idx on public.demo_sessions(room_id);

alter table public.demo_rooms enable row level security;
alter table public.demo_sessions enable row level security;
revoke all on public.demo_rooms from anon, authenticated;
revoke all on public.demo_sessions from anon, authenticated;
grant select, insert, update, delete on public.demo_rooms, public.demo_sessions to service_role;
grant select on public.demo_rooms to anon;
create policy "Public demo room read" on public.demo_rooms for select to anon using (true);

create or replace function public.demo_claim_role(p_room uuid, p_hash text, p_role text)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_session public.demo_sessions%rowtype;
begin
  if p_role not in ('portfolio', 'lending', 'broker_a', 'broker_b', 'custodian') then
    raise exception 'invalid_role';
  end if;
  select * into v_session from public.demo_sessions
    where room_id = p_room and token_hash = p_hash for update;
  if not found or v_session.kicked then raise exception 'session_not_authorized'; end if;
  update public.demo_sessions set role = p_role, last_seen_at = now() where id = v_session.id;
exception when unique_violation then raise exception 'role_already_assigned';
end;
$$;

create or replace function public.demo_commit_event(p_room uuid, p_hash text, p_expected_version integer, p_event jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_room public.demo_rooms%rowtype;
declare v_session public.demo_sessions%rowtype;
declare v_action text;
declare v_role text;
begin
  select * into v_room from public.demo_rooms where id = p_room for update;
  if not found then raise exception 'room_missing'; end if;
  if exists (select 1 from jsonb_array_elements(v_room.events) e where e->>'id' = p_event->>'id') then return; end if;
  select * into v_session from public.demo_sessions
    where room_id = p_room and token_hash = p_hash for update;
  if not found or v_session.kicked or v_session.role is null then raise exception 'session_not_authorized'; end if;
  v_action := p_event->>'action';
  v_role := case v_action
    when 'place_sale' then 'portfolio'
    when 'issue_recall' then 'lending'
    when 'return_150k' then 'broker_a'
    when 'return_100k' then 'broker_b'
    when 'confirm_delivery' then 'custodian'
    when 'release_collateral' then 'lending'
    when 'settle_sale' then 'custodian'
    else null end;
  if v_role is null or v_role <> v_session.role or p_event->>'actorRole' <> v_role then
    raise exception 'role_not_authorized';
  end if;
  if v_room.version <> p_expected_version then raise exception 'version_conflict'; end if;
  if (p_event->>'run')::integer <> v_room.run or (p_event->>'seq')::integer <> v_room.version + 1 then
    raise exception 'event_order_invalid';
  end if;
  update public.demo_rooms set version = version + 1, events = events || jsonb_build_array(p_event)
    where id = p_room;
  update public.demo_sessions set last_seen_at = now() where id = v_session.id;
end;
$$;

create or replace function public.demo_reset_room(p_room uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.demo_rooms set run = run + 1, version = version + 1 where id = p_room;
  if not found then raise exception 'room_missing'; end if;
end;
$$;

revoke all on function public.demo_claim_role(uuid,text,text) from public, anon, authenticated;
revoke all on function public.demo_commit_event(uuid,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.demo_reset_room(uuid) from public, anon, authenticated;
grant execute on function public.demo_claim_role(uuid,text,text) to service_role;
grant execute on function public.demo_commit_event(uuid,text,integer,jsonb) to service_role;
grant execute on function public.demo_reset_room(uuid) to service_role;

insert into public.demo_rooms (id) values ('29cdb848-0ae6-456c-a27a-5fb3bff21d02') on conflict do nothing;
alter publication supabase_realtime add table public.demo_rooms;
