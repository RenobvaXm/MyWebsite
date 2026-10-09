begin;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create table public.workspace_email_queue(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,recipient_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('messages','payments','approvals','deliveries')),label text not null,status text not null default 'pending' check(status in ('pending','processing','sent','skipped','failed')),attempts int not null default 0,created_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),last_error text,provider_id text);
alter table public.workspace_email_queue enable row level security;
revoke all on public.workspace_email_queue from anon,authenticated;
grant select on public.workspace_email_queue to authenticated;
create policy workspace_email_queue_admin_read on public.workspace_email_queue for select to authenticated using(public.is_admin());
create index workspace_email_queue_due_idx on public.workspace_email_queue(next_attempt_at) where status in ('pending','processing');
create index workspace_email_queue_recipient_idx on public.workspace_email_queue(recipient_id,project_id,kind,created_at);
-- Only trusted table triggers can enqueue mail. Opt-in and category choice are checked again by the worker.
create function renobva_private.enqueue_workspace_email() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_id uuid;actor_id uuid;recipient uuid;event_kind text;label text;row_json jsonb;pref public.notification_preferences;
begin
 row_json:=to_jsonb(new);
 if TG_OP='UPDATE' and TG_TABLE_NAME in ('payment_requests','project_quotes','project_reviews') and row_json->>'status' is not distinct from to_jsonb(old)->>'status' then return new;end if;
 select user_id into owner_id from public.projects where id=(row_json->>'project_id')::uuid;
 actor_id:=case when TG_TABLE_NAME='messages' then (row_json->>'sender_id')::uuid when TG_TABLE_NAME='workspace_files' then (row_json->>'uploaded_by')::uuid when TG_TABLE_NAME='project_comments' then (row_json->>'author_id')::uuid else auth.uid() end;
 if actor_id is null then select id into actor_id from public.profiles where role='admin' order by id limit 1;end if;
 event_kind:=case when TG_TABLE_NAME in ('messages','workspace_files') then 'messages' when TG_TABLE_NAME='payment_requests' then 'payments' when TG_TABLE_NAME in ('project_deliveries','project_handover') then 'deliveries' else 'approvals' end;
 label:=case TG_TABLE_NAME when 'messages' then 'New project message' when 'workspace_files' then 'New project files' when 'payment_requests' then 'Payment update: '||(row_json->>'status') when 'project_quotes' then 'Quote update: '||(row_json->>'status') when 'project_reviews' then 'Design review update: '||(row_json->>'status') when 'project_comments' then 'New page feedback' when 'project_deliveries' then 'Your delivery is ready' else 'Handover details updated' end;
 for recipient in select id from public.profiles where (actor_id=owner_id and role='admin') or (actor_id<>owner_id and id=owner_id) loop
 select * into pref from public.notification_preferences where user_id=recipient;
 if pref.email is true and (to_jsonb(pref)->>event_kind)::boolean is true and not exists(select 1 from public.workspace_email_queue q where q.project_id=(row_json->>'project_id')::uuid and q.recipient_id=recipient and q.kind=event_kind and q.created_at>now()-interval '1 minute' and q.status in ('pending','processing','sent')) then
 insert into public.workspace_email_queue(project_id,recipient_id,kind,label) values((row_json->>'project_id')::uuid,recipient,event_kind,label);
 end if;
 end loop;
 return new;
end;$$;
revoke all on function renobva_private.enqueue_workspace_email() from public,anon,authenticated;
create trigger messages_email_event after insert on public.messages for each row execute function renobva_private.enqueue_workspace_email();
create trigger workspace_files_email_event after insert on public.workspace_files for each row execute function renobva_private.enqueue_workspace_email();
create trigger project_comments_email_event after insert on public.project_comments for each row execute function renobva_private.enqueue_workspace_email();
create trigger project_deliveries_email_event after insert on public.project_deliveries for each row execute function renobva_private.enqueue_workspace_email();
create trigger project_handover_email_event after insert or update on public.project_handover for each row execute function renobva_private.enqueue_workspace_email();
create trigger payment_requests_email_event after insert or update on public.payment_requests for each row execute function renobva_private.enqueue_workspace_email();
create trigger project_quotes_email_event after insert or update on public.project_quotes for each row execute function renobva_private.enqueue_workspace_email();
create trigger project_reviews_email_event after insert or update on public.project_reviews for each row execute function renobva_private.enqueue_workspace_email();
-- A random cron credential lives only in Vault, never in source or frontend code.
do $$begin
 if not exists(select 1 from vault.secrets where name='renobva_mail_worker_key') then perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'renobva_mail_worker_key');end if;
end;$$;
create function public.authorize_workspace_mail_worker(candidate text) returns boolean language sql security definer set search_path='' as $$select length(candidate)=72 and exists(select 1 from vault.decrypted_secrets where name='renobva_mail_worker_key' and decrypted_secret=candidate)$$;
revoke all on function public.authorize_workspace_mail_worker(text) from public,anon,authenticated;
grant execute on function public.authorize_workspace_mail_worker(text) to service_role;
create function public.claim_workspace_emails() returns setof public.workspace_email_queue language sql security invoker set search_path='' as $$
 update public.workspace_email_queue q set status='processing',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes'
 where id in (select id from public.workspace_email_queue where status in ('pending','processing') and next_attempt_at<=now() and attempts<6 order by created_at for update skip locked limit 10) returning q.*
$$;
revoke all on function public.claim_workspace_emails() from public,anon,authenticated;
grant execute on function public.claim_workspace_emails() to service_role;
select cron.schedule('renobva-workspace-email','* * * * *',$job$
 select net.http_post(url:='https://bdpfqjzxrbvhcztqqjsf.supabase.co/functions/v1/workspace-notifications',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='renobva_mail_worker_key')),body:='{}'::jsonb,timeout_milliseconds:=60000)
 where exists(select 1 from public.workspace_email_queue where status in ('pending','processing') and next_attempt_at<=now() and attempts<6);
$job$);
commit;
