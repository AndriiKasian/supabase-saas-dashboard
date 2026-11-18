-- Table privileges and owner-only RLS policies for tasks and user_preferences.
--
-- Privileges are reset explicitly so every environment ends up identical:
-- some projects auto-grant new tables to anon/authenticated, others do not.
-- service_role is intentionally left unchanged.

-- Privileges ---------------------------------------------------------------

revoke all on table public.tasks from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;

grant select, insert, update, delete on table public.tasks to authenticated;
-- No DELETE: preferences are upserted, and removed with the user by cascade.
grant select, insert, update on table public.user_preferences to authenticated;

-- tasks policies -----------------------------------------------------------
-- (select auth.uid()) is evaluated once per statement, not once per row.

create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tasks_insert_own" on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tasks_update_own" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own" on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_preferences policies ------------------------------------------------

create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
