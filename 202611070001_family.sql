-- Wochenkorb V5: one family-owned document + independent per-item checkmarks.
-- Deploy in Supabase SQL Editor (once). Every public table has RLS enabled.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 70),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  added_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- one household per user for the current version
);
create index if not exists household_members_user_idx on public.household_members(user_id);
create table if not exists public.household_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  constraint state_json_object check (jsonb_typeof(content) = 'object')
);
create table if not exists public.item_statuses (
  household_id uuid not null references public.households(id) on delete cascade,
  week_id text not null check (length(week_id) between 1 and 100),
  item_key text not null check (length(item_key) between 1 and 200),
  status text not null default 'open' check (status in ('open','have','bought')),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  primary key (household_id, week_id, item_key)
);
create index if not exists item_statuses_week_idx on public.item_statuses(household_id, week_id);
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'midnight' check (theme in ('midnight','rose-light','rose-dark')),
  updated_at timestamptz not null default now()
);
create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  uses int not null default 0,
  max_uses int not null default 1 check (max_uses between 1 and 10),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_state enable row level security;
alter table public.item_statuses enable row level security;
alter table public.user_preferences enable row level security;
alter table public.household_invites enable row level security;

-- Use a carefully scoped definer function to avoid RLS recursion in household_members.
create or replace function public.is_household_member(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create policy household_read on public.households for select to authenticated
  using (public.is_household_member(id));
create policy member_read on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy state_read on public.household_state for select to authenticated
  using (public.is_household_member(household_id));
-- No direct write policy for the aggregate; CAS RPC protects concurrent edits.
create policy status_read on public.item_statuses for select to authenticated
  using (public.is_household_member(household_id));
create policy status_insert on public.item_statuses for insert to authenticated
  with check (public.is_household_member(household_id) and changed_by = (select auth.uid()));
create policy status_update on public.item_statuses for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and changed_by = (select auth.uid()));
create policy prefs_read on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy prefs_insert on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy prefs_update on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- No direct invite SELECT/INSERT/UPDATE/DELETE to clients; only controlled RPCs.

create or replace function public.create_household(p_name text, p_initial_state jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from public.household_members where user_id=v_uid) then
    raise exception 'already_in_household';
  end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 70 then raise exception 'invalid_household_name'; end if;
  if jsonb_typeof(p_initial_state) <> 'object' or octet_length(p_initial_state::text)>2000000 then
    raise exception 'invalid_initial_state';
  end if;
  insert into public.households(name,created_by) values(trim(p_name),v_uid) returning id into v_id;
  insert into public.household_members(household_id,user_id,role) values(v_id,v_uid,'owner');
  insert into public.household_state(household_id,content,changed_by) values(v_id,p_initial_state,v_uid);
  return v_id;
end $$;

create or replace function public.create_household_invite(p_household uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_token text;
begin
  if not exists(select 1 from public.household_members
    where household_id=p_household and user_id=v_uid and role='owner') then
    raise exception 'not_owner';
  end if;
  -- 256 bits of randomness, one-time, expires in seven days.
  v_token := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.household_invites(household_id,token_hash,expires_at,created_by)
    values(p_household,md5(v_token),now()+interval '7 days',v_uid);
  return v_token;
end $$;

create or replace function public.join_household(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.household_invites%rowtype; v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from public.household_members where user_id=v_uid) then raise exception 'already_in_household'; end if;
  if length(coalesce(p_token,''))<>64 or p_token !~ '^[a-f0-9]+$' then raise exception 'invalid_invitation'; end if;
  select * into v_inv from public.household_invites
    where token_hash=md5(p_token) and expires_at>now() and uses<max_uses for update;
  if not found then raise exception 'invalid_or_expired_invitation'; end if;
  insert into public.household_members(household_id,user_id,role) values(v_inv.household_id,v_uid,'member');
  update public.household_invites set uses=uses+1 where id=v_inv.id;
  return v_inv.household_id;
end $$;

create or replace function public.save_household_state(p_household uuid,p_revision bigint,p_content jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_new bigint;
begin
  if not public.is_household_member(p_household) then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text)>2000000 then
    raise exception 'invalid_content';
  end if;
  update public.household_state
    set content=p_content,revision=revision+1,changed_by=auth.uid(),changed_at=now()
    where household_id=p_household and revision=p_revision
    returning revision into v_new;
  if not found then raise exception 'revision_conflict'; end if;
  return v_new;
end $$;

revoke all on function public.create_household(text,jsonb) from public;
revoke all on function public.create_household_invite(uuid) from public;
revoke all on function public.join_household(text) from public;
revoke all on function public.save_household_state(uuid,bigint,jsonb) from public;
grant execute on function public.create_household(text,jsonb) to authenticated;
grant execute on function public.create_household_invite(uuid) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.save_household_state(uuid,bigint,jsonb) to authenticated;

-- Small family subscription count: postgres_changes is simple and sufficient.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_state') then
    alter publication supabase_realtime add table public.household_state;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='item_statuses') then
    alter publication supabase_realtime add table public.item_statuses;
  end if;
end $$;
