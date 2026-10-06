alter table public.projects add column if not exists submission_key uuid;
create unique index if not exists projects_submission_key_idx on public.projects(submission_key) where submission_key is not null;
create table if not exists public.project_email_delivery (
 project_id uuid not null references public.projects(id) on delete cascade,
 kind text not null check(kind in ('owner','confirmation')),
 status text not null default 'pending' check(status in ('pending','sent','failed')),
 provider_id text, last_error text, updated_at timestamptz not null default now(),
 primary key(project_id,kind));
alter table public.project_email_delivery enable row level security;
grant select on public.project_email_delivery to authenticated;
create policy email_delivery_read on public.project_email_delivery for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
revoke update on public.profiles from authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
alter table public.messages drop constraint if exists messages_body_or_attachment_check;
alter table public.messages add constraint messages_body_or_attachment_check check ((char_length(body) between 1 and 5000) or attachment_path is not null or deleted_at is not null);
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='projects') then alter publication supabase_realtime add table public.projects; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
end $$;
