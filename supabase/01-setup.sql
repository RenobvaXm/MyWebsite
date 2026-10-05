
-- RENOBVA Client Portal
-- Run in Supabase SQL Editor once.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  service_type text not null,
  category text not null default 'business',
  budget text,
  deadline date,
  brief text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','questions','in progress','review','completed','cancelled')),
  quoted_price numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,display_name)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)))
 on conflict(id) do nothing;
 return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select using (id=auth.uid() or public.is_admin());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists "projects_read" on public.projects;
create policy "projects_read" on public.projects for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects for insert with check (user_id=auth.uid());
drop policy if exists "projects_admin_update" on public.projects;
create policy "projects_admin_update" on public.projects for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "messages_read" on public.messages;
create policy "messages_read" on public.messages for select using (
 public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid())
);
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert with check (
 sender_id=auth.uid() and (public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()))
);

-- Realtime
alter publication supabase_realtime add table public.messages;

-- IMPORTANT:
-- After registering YOUR personal account, make yourself admin ONCE:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';
