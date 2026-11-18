-- Initial schema: tasks and user_preferences.
-- RLS is enabled with no policies, so anon and authenticated clients cannot
-- read or write any rows until policies are added in a later migration.

-- updated_at maintenance --------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Only used by triggers; never callable through the API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- tasks --------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every query is scoped to one user, so user_id leads each index. These also
-- cover the foreign key, so no separate user_id index is needed.
create index tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);
create index tasks_user_id_status_due_date_idx
  on public.tasks (user_id, status, due_date);
create index tasks_user_id_due_date_idx
  on public.tasks (user_id, due_date);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- user_preferences -----------------------------------------------------------

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status_filter text
    check (status_filter in ('todo', 'in_progress', 'done')),
  date_from date,
  date_to date,
  updated_at timestamptz not null default now(),
  constraint user_preferences_date_range_check
    check (date_from is null or date_to is null or date_from <= date_to)
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;
