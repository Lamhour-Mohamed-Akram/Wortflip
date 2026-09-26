-- Wortflip community topics: run once in the Supabase SQL editor (safe to run again).
--
-- Every learner can read the visible topics and share their own; nobody can edit
-- or delete through the app. Reports hide a topic after three different devices
-- flagged it; the project owner cleans up in the dashboard.

create extension if not exists pgcrypto;

create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  theme       text not null,
  level       text not null,
  items       jsonb not null,
  device      text not null,
  reports     integer not null default 0,
  hidden      boolean not null default false,
  constraint topics_theme_length check (char_length(theme) between 2 and 40),
  constraint topics_level check (level in ('A1', 'A2', 'B1', 'B2', 'C1')),
  constraint topics_items_array check (jsonb_typeof(items) = 'array'),
  constraint topics_items_count check (jsonb_array_length(items) between 1 and 100),
  constraint topics_items_size check (pg_column_size(items) < 100000),
  constraint topics_device_length check (char_length(device) between 8 and 64)
);

-- Re-runs on an existing table: lift the older 60-word limit to 100.
alter table public.topics drop constraint if exists topics_items_count;
alter table public.topics add constraint topics_items_count check (jsonb_array_length(items) between 1 and 100);
alter table public.topics drop constraint if exists topics_items_size;
alter table public.topics add constraint topics_items_size check (pg_column_size(items) < 100000);

create index if not exists topics_visible_idx on public.topics (created_at) where hidden = false;

create table if not exists public.topic_reports (
  topic_id    uuid not null references public.topics (id) on delete cascade,
  device      text not null,
  created_at  timestamptz not null default now(),
  primary key (topic_id, device),
  constraint topic_reports_device_length check (char_length(device) between 8 and 64)
);

-- Offensive words never enter a topic. Same stems as src/community/badwords.ts,
-- matched at the start of a word after folding umlauts and ß.
create or replace function public.topics_is_offensive(txt text)
returns boolean
language sql
immutable
as $$
  select replace(replace(replace(replace(lower(coalesce(txt, '')), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss')
         ~ '(^|[^a-z0-9])(arsch|fick|fotze|hure|huren|nutte|wichs|schwuchtel|schlampe|scheiss|pisse|pisser|titten|muschi|neger|kanake|spasti|spast|mongo|nazi|hitler|missgeburt|drecksau|hurensohn|fuck|shit|bitch|cunt|asshole|nigger|faggot|whore|slut|motherfucker)';
$$;

-- Shape check for one entry: the app validates first, this is the safety net.
create or replace function public.topics_check_entry(entry jsonb)
returns void
language plpgsql
as $$
begin
  if jsonb_typeof(entry) <> 'object' then
    raise exception 'entry is not an object';
  end if;
  if public.topics_is_offensive(entry->>'word') or public.topics_is_offensive(entry->>'definitionDe')
     or public.topics_is_offensive(entry->>'exampleDe') or public.topics_is_offensive(entry->>'translationEn') then
    raise exception 'offensive content';
  end if;
  if coalesce(char_length(entry->>'word'), 0) not between 1 and 40
     or coalesce(char_length(entry->>'definitionDe'), 0) not between 2 and 300
     or coalesce(char_length(entry->>'exampleDe'), 0) not between 2 and 300
     or (entry->>'type') not in ('noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'other') then
    raise exception 'entry % is incomplete', entry->>'word';
  end if;
end;
$$;

create or replace function public.topics_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
begin
  if public.topics_is_offensive(new.theme) then
    raise exception 'offensive content';
  end if;
  for entry in select * from jsonb_array_elements(new.items) loop
    perform public.topics_check_entry(entry);
  end loop;
  -- Rate limit: at most 5 topics per device and day (hidden ones count too; the
  -- function runs with owner rights so row level security does not filter them).
  if (select count(*) from public.topics t where t.device = new.device and t.created_at > now() - interval '1 day') >= 5 then
    raise exception 'daily limit reached';
  end if;
  -- Global cap: at most 200 shared topics per day for everyone, so a spammer
  -- who fakes device ids cannot fill the table. Readers are never affected.
  if (select count(*) from public.topics t where t.created_at > now() - interval '1 day') >= 200 then
    raise exception 'global daily limit reached';
  end if;
  new.reports := 0;
  new.hidden := false;
  return new;
end;
$$;

drop trigger if exists topics_validate_trigger on public.topics;
create trigger topics_validate_trigger
  before insert on public.topics
  for each row execute function public.topics_validate();

-- A report counts once per device; three reports hide the topic.
create or replace function public.topic_reports_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.topics
     set reports = reports + 1,
         hidden = (reports + 1) >= 3 or hidden
   where id = new.topic_id;
  return new;
end;
$$;

drop trigger if exists topic_reports_apply_trigger on public.topic_reports;
create trigger topic_reports_apply_trigger
  after insert on public.topic_reports
  for each row execute function public.topic_reports_apply();

-- Sharing with merge: the same topic name and level is one community topic.
-- New words are appended to it (up to 100); a new level makes a new topic.
-- Returns the resulting topic without the device column.
create or replace function public.share_topic(p_theme text, p_level text, p_items jsonb, p_device text)
returns table (id uuid, created_at timestamptz, theme text, level text, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.topics%rowtype;
  merged jsonb;
  entry jsonb;
  keys text[];
  k text;
  added integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'no entries';
  end if;
  if public.topics_is_offensive(p_theme) then
    raise exception 'offensive content';
  end if;
  select * into existing
    from public.topics t
   where lower(t.theme) = lower(trim(p_theme)) and t.level = p_level and t.hidden = false
   order by t.created_at asc
   limit 1;
  if existing.id is null then
    return query
      insert into public.topics (theme, level, items, device)
      values (trim(p_theme), p_level, p_items, p_device)
      returning topics.id, topics.created_at, topics.theme, topics.level, topics.items;
    return;
  end if;
  merged := existing.items;
  select coalesce(array_agg(lower(e->>'word') || '|' || (e->>'type')), '{}') into keys
    from jsonb_array_elements(existing.items) e;
  for entry in select * from jsonb_array_elements(p_items) loop
    perform public.topics_check_entry(entry);
    k := lower(entry->>'word') || '|' || (entry->>'type');
    if not (k = any(keys)) and jsonb_array_length(merged) < 100 then
      merged := merged || jsonb_build_array(entry);
      keys := keys || k;
      added := added + 1;
    end if;
  end loop;
  if added > 0 then
    update public.topics t set items = merged where t.id = existing.id;
  end if;
  return query
    select t.id, t.created_at, t.theme, t.level, t.items from public.topics t where t.id = existing.id;
end;
$$;

grant execute on function public.share_topic(text, text, jsonb, text) to anon;

-- Row level security: read visible topics, insert topics and reports, nothing else.
alter table public.topics enable row level security;
alter table public.topic_reports enable row level security;

drop policy if exists "topics are readable when visible" on public.topics;
create policy "topics are readable when visible"
  on public.topics for select
  to anon
  using (hidden = false);

drop policy if exists "anyone can share a topic" on public.topics;
create policy "anyone can share a topic"
  on public.topics for insert
  to anon
  with check (true);

drop policy if exists "anyone can report a topic" on public.topic_reports;
create policy "anyone can report a topic"
  on public.topic_reports for insert
  to anon
  with check (true);

-- The app never updates or deletes; only the dashboard (service role) can.
grant select, insert on public.topics to anon;
grant insert on public.topic_reports to anon;
revoke update, delete on public.topics from anon;
