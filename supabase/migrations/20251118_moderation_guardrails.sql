-- Moderation hardening: helper to detect admin roles and RLS policies for destructive actions.
-- Review and adjust role names / allowed operations before applying to production.

create or replace function public.current_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
$$;

create or replace function public.is_admin(claims jsonb default public.current_claims())
returns boolean
language sql
stable
as $$
  with roles as (
    select array_remove(
      array_cat(
        array[
          lower(coalesce(claims ->> 'role', '')),
          lower(coalesce(claims -> 'app_metadata' ->> 'role', '')),
          lower(coalesce(claims -> 'user_metadata' ->> 'role', ''))
        ],
        case
          when jsonb_typeof(claims -> 'app_metadata' -> 'roles') = 'array'
            then array(select lower(value::text) from jsonb_array_elements_text(claims -> 'app_metadata' -> 'roles'))
          else array[]::text[]
        end
      ),
      ''
    ) as roles
  )
  select exists (select 1 from unnest(roles.roles) r where r in ('admin', 'ceo'));
$$;

alter table if exists public.posts enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.reports enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.post_deletions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'posts_select_all') then
    create policy posts_select_all on public.posts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'posts_insert_owner_only') then
    create policy posts_insert_owner_only on public.posts for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'posts_update_owner_or_admin') then
    create policy posts_update_owner_or_admin on public.posts
      for update
      using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where polname = 'posts_delete_owner_or_admin') then
    create policy posts_delete_owner_or_admin on public.posts
      for delete
      using (auth.uid() = user_id or public.is_admin());
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'comments_select_all') then
    create policy comments_select_all on public.comments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'comments_insert_owner_only') then
    create policy comments_insert_owner_only on public.comments for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'comments_update_owner_or_admin') then
    create policy comments_update_owner_or_admin on public.comments
      for update
      using (auth.uid() = user_id or public.is_admin())
      with check (auth.uid() = user_id or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where polname = 'comments_delete_owner_or_admin') then
    create policy comments_delete_owner_or_admin on public.comments
      for delete
      using (auth.uid() = user_id or public.is_admin());
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'reports_select_admin_only') then
    create policy reports_select_admin_only on public.reports for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where polname = 'reports_insert_authenticated') then
    create policy reports_insert_authenticated on public.reports for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where polname = 'reports_delete_admin_only') then
    create policy reports_delete_admin_only on public.reports for delete using (public.is_admin());
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'notifications_select_owner') then
    create policy notifications_select_owner on public.notifications for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where polname = 'notifications_insert_sender_or_target') then
    create policy notifications_insert_sender_or_target on public.notifications
      for insert
      with check (
        public.is_admin()
        or auth.uid() = user_id
        or auth.uid() = from_user_id
      );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'post_deletions_select_admin_or_owner') then
    create policy post_deletions_select_admin_or_owner on public.post_deletions
      for select
      using (public.is_admin() or auth.uid() = user_id or auth.uid() = deleted_by);
  end if;
  if not exists (select 1 from pg_policies where polname = 'post_deletions_insert_admin_only') then
    create policy post_deletions_insert_admin_only on public.post_deletions
      for insert
      with check (public.is_admin());
  end if;
end$$;
