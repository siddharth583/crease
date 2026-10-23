-- Crease: shared clubs. Paste this whole file into Supabase → SQL Editor → Run.
--
-- There are no logins: a club's code is its key. The tables are closed to the app's public key, so a phone can
-- only reach a club's data through the functions below, and only by knowing its code. Nobody can list clubs.

create table if not exists public.clubs (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.club_matches (
  club text not null references public.clubs (code) on delete cascade,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (club, id)
);

create table if not exists public.club_teams (
  club text not null references public.clubs (code) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (club, id)
);

create index if not exists club_matches_updated on public.club_matches (club, updated_at);
create index if not exists club_teams_updated on public.club_teams (club, updated_at);

alter table public.clubs enable row level security;
alter table public.club_matches enable row level security;
alter table public.club_teams enable row level security;
-- No policies on purpose: direct table access is denied; the security definer functions below do the work.

create or replace function public.club_create(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if length(p_code) < 8 or length(trim(p_name)) = 0 then
    raise exception 'bad club';
  end if;
  insert into clubs (code, name) values (upper(p_code), left(trim(p_name), 40));
  return json_build_object('code', upper(p_code), 'name', left(trim(p_name), 40));
end $$;

create or replace function public.club_info(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('code', code, 'name', name) from clubs where code = upper(p_code);
$$;

-- Everything changed in a club since p_since, plus the server's clock for the next call.
create or replace function public.club_pull(p_code text, p_since timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'now', now(),
    'matches', coalesce((
      select json_agg(json_build_object('id', id, 'data', data, 'deleted', deleted))
      from club_matches where club = upper(p_code) and updated_at > p_since
    ), '[]'::json),
    'teams', coalesce((
      select json_agg(data) from club_teams where club = upper(p_code) and updated_at > p_since
    ), '[]'::json)
  )
  where exists (select 1 from clubs where code = upper(p_code));
$$;

-- p_matches: [{ id, data, deleted }]; p_teams: [team]. Last write wins per match.
create or replace function public.club_push(p_code text, p_matches jsonb, p_teams jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from clubs where code = upper(p_code)) then
    raise exception 'unknown club';
  end if;
  insert into club_matches (club, id, data, deleted, updated_at)
  select upper(p_code), m->>'id', m->'data', coalesce((m->>'deleted')::boolean, false), now()
  from jsonb_array_elements(p_matches) m
  on conflict (club, id) do update set data = excluded.data, deleted = excluded.deleted, updated_at = now();

  insert into club_teams (club, id, data, updated_at)
  select upper(p_code), t->>'id', t, now()
  from jsonb_array_elements(p_teams) t
  on conflict (club, id) do update set data = excluded.data, updated_at = now();
end $$;

revoke all on public.clubs, public.club_matches, public.club_teams from anon, authenticated;
grant execute on function public.club_create(text, text) to anon, authenticated;
grant execute on function public.club_info(text) to anon, authenticated;
grant execute on function public.club_pull(text, timestamptz) to anon, authenticated;
grant execute on function public.club_push(text, jsonb, jsonb) to anon, authenticated;
