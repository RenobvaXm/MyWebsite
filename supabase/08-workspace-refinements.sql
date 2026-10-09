begin;
-- Clients cannot mark new feedback resolved at creation.
alter policy project_comments_add on public.project_comments with check(author_id=(select auth.uid()) and resolved=false and (public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))));
-- Store the exact agreed payment note, including an applied discount breakdown.
create or replace function renobva_private.issue_payment_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and (TG_OP='INSERT' or old.status is distinct from 'paid') then
 insert into public.payment_documents(payment_id,project_id,client_id,description,amount,currency,seller,buyer,document_type)
 select new.id,new.project_id,new.client_id,new.title||case when coalesce(new.note,'')<>'' then E'\n'||new.note else '' end,new.amount,new.currency,to_jsonb(s),coalesce((select to_jsonb(b) from public.billing_profiles b where b.user_id=new.client_id),'{}'::jsonb),case when length(trim(s.legal_name))>0 and length(trim(s.address))>0 and exists(select 1 from public.billing_profiles b where b.user_id=new.client_id and length(trim(b.legal_name))>0 and length(trim(b.address))>0) then 'invoice' else 'receipt' end from public.business_billing s where s.id=true
 on conflict(payment_id) do nothing;
 end if;
 return new;
end;$$;
revoke all on function renobva_private.issue_payment_document() from public,anon,authenticated;
grant update(status,next_attempt_at,attempts,last_error) on public.workspace_email_queue to authenticated;
create policy workspace_email_queue_retry on public.workspace_email_queue for update to authenticated using(public.is_admin() and status='failed') with check(public.is_admin() and status='pending' and attempts=0 and last_error is null);
create function public.retry_failed_workspace_emails() returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required';end if;
 update public.workspace_email_queue set status='pending',attempts=0,next_attempt_at=now(),last_error=null where status='failed' and created_at>now()-interval '1 day';
end;$$;
revoke all on function public.retry_failed_workspace_emails() from public,anon;
grant execute on function public.retry_failed_workspace_emails() to authenticated;
commit;
