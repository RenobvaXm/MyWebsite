begin;
create or replace function public.submit_payment_request(p_payment uuid,p_method text,p_reference text default null) returns public.payment_requests language plpgsql security definer set search_path='' as $$
declare r public.payment_requests;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_method<>'bank' then raise exception 'Use bank transfer or the secure Stripe checkout';end if;
 update public.payment_requests pay set selected_method='bank',client_reference=nullif(trim(p_reference),''),status='submitted',submitted_at=now(),updated_at=now()
 where pay.id=p_payment and pay.client_id=auth.uid() and pay.status in ('pending','submitted') and not pay.stripe_locked
 and exists(select 1 from public.projects p where p.id=pay.project_id and p.user_id=auth.uid() and p.archived_at is null and p.deleted_at is null)
 returning pay.* into r;
 if r.id is null then raise exception 'Payment request unavailable. The project may be archived, trashed or using Stripe checkout.';end if;
 return r;
end;$$;
revoke all on function public.submit_payment_request(uuid,text,text) from public,anon;
grant execute on function public.submit_payment_request(uuid,text,text) to authenticated;
alter policy payments_read on public.payment_requests using(public.is_admin() or (client_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.deleted_at is null)));
commit;
