-- RENOBVA chat payment requests
-- Run once in Supabase SQL Editor after the existing setup files.
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  note text,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency in ('EUR','USD','GBP')),
  status text not null default 'pending' check (status in ('pending','submitted','paid','cancelled')),
  selected_method text check (selected_method in ('paypal','bank','revolut') or selected_method is null),
  client_reference text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.payment_requests enable row level security;

drop policy if exists "payments_read" on public.payment_requests;
create policy "payments_read" on public.payment_requests for select using (
  public.is_admin() or client_id=auth.uid()
);

drop policy if exists "payments_admin_insert" on public.payment_requests;
create policy "payments_admin_insert" on public.payment_requests for insert with check (
  public.is_admin() and created_by=auth.uid()
  and exists(select 1 from public.projects p where p.id=project_id and p.user_id=client_id)
);

drop policy if exists "payments_admin_update" on public.payment_requests;
create policy "payments_admin_update" on public.payment_requests for update using (public.is_admin()) with check (public.is_admin());

-- Clients can only use this RPC to submit a payment method/reference; they cannot mark themselves paid.
create or replace function public.submit_payment_request(p_payment uuid,p_method text,p_reference text default null)
returns public.payment_requests
language plpgsql security definer set search_path=public as $$
declare r public.payment_requests;
begin
 if p_method not in ('paypal','bank','revolut') then raise exception 'Unsupported payment method'; end if;
 update public.payment_requests
 set selected_method=p_method, client_reference=nullif(trim(p_reference),''), status='submitted', submitted_at=now(), updated_at=now()
 where id=p_payment and client_id=auth.uid() and status in ('pending','submitted')
 returning * into r;
 if r.id is null then raise exception 'Payment request not found or unavailable'; end if;
 return r;
end $$;
revoke all on function public.submit_payment_request(uuid,text,text) from public,anon;
grant execute on function public.submit_payment_request(uuid,text,text) to authenticated;

-- Enable realtime if it is not already in the publication.
do $$ begin
  alter publication supabase_realtime add table public.payment_requests;
exception when duplicate_object then null;
end $$;
