alter table public.payment_requests add column if not exists stripe_session_id text unique;
alter table public.payment_requests add column if not exists stripe_locked boolean not null default false;
alter table public.payment_requests drop constraint if exists payment_requests_selected_method_check;
alter table public.payment_requests add constraint payment_requests_selected_method_check check(selected_method is null or selected_method in ('stripe','paypal','bank','revolut','wise','card','applepay','googlepay','klarna'));
-- Browsers cannot set Stripe identifiers or unlock a quote.
revoke update on public.payment_requests from authenticated;
grant update(status,paid_at,updated_at) on public.payment_requests to authenticated;
create or replace function public.guard_stripe_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if old.stripe_locked and coalesce(auth.role(),'') <> 'service_role' then
  raise exception 'Stripe checkout has started. This quote is locked; payment confirmation is automatic.';
 end if;
 return new;
end $$;
drop trigger if exists guard_stripe_payment on public.payment_requests;
create trigger guard_stripe_payment before update on public.payment_requests for each row execute function public.guard_stripe_payment();
revoke all on function public.guard_stripe_payment() from public,anon,authenticated;
