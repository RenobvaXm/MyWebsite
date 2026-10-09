-- Applied through Supabase MCP; setup reference for new installations.
begin;
alter table public.projects add column preview_url text check(preview_url ~ '^https://'), add column revision_bonus int not null default 0 check(revision_bonus between 0 and 100);
grant update(preview_url,revision_bonus) on public.projects to authenticated;
create function renobva_private.guard_project_extras() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() and (new.preview_url is distinct from old.preview_url or new.revision_bonus is distinct from old.revision_bonus) then raise exception 'Only admin may change preview links and revision allowances';end if;
 return new;
end;$$;
revoke all on function renobva_private.guard_project_extras() from public,anon,authenticated;
create trigger guard_project_extras before update on public.projects for each row execute function renobva_private.guard_project_extras();
alter table public.project_quotes add column delivery_date date;
create function renobva_private.stamp_workflow_decision() returns trigger language plpgsql security invoker set search_path='' as $$
begin if old.status='pending' and new.status<>old.status then new.decided_at:=now();end if;return new;end;$$;
revoke all on function renobva_private.stamp_workflow_decision() from public,anon,authenticated;
create trigger stamp_quote_decision before update on public.project_quotes for each row execute function renobva_private.stamp_workflow_decision();
create trigger stamp_review_decision before update on public.project_reviews for each row execute function renobva_private.stamp_workflow_decision();
alter table public.project_handover add column renewal_date date,add column renewal_interval_months int not null default 1 check(renewal_interval_months between 1 and 12);

create table public.project_revision_requests(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,
 quote_id uuid not null references public.project_quotes(id),requested_by uuid not null references public.profiles(id),
 review_id uuid unique references public.project_reviews(id),delivery_id uuid unique references public.project_deliveries(id),
 title text not null check(length(trim(title)) between 3 and 200),body text not null check(length(trim(body)) between 10 and 5000),
 status text not null default 'pending' check(status in ('pending','in_progress','completed','declined','extra_quote')),
 counts_allowance boolean not null default true,response text not null default '' check(length(response)<=5000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(review_id is null or delivery_id is null));
create index revision_project_idx on public.project_revision_requests(project_id,created_at desc);
create index revision_quote_idx on public.project_revision_requests(quote_id);
create index revision_requester_idx on public.project_revision_requests(requested_by);
create index revision_delivery_idx on public.project_revision_requests(delivery_id);
alter table public.project_revision_requests enable row level security;
revoke all on public.project_revision_requests from public,anon,authenticated;
grant select on public.project_revision_requests to authenticated;
grant insert(project_id,quote_id,requested_by,title,body) on public.project_revision_requests to authenticated;
grant update(status,response) on public.project_revision_requests to authenticated;
create policy revisions_read on public.project_revision_requests for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy revisions_add on public.project_revision_requests for insert to authenticated with check(requested_by=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.archived_at is null and p.deleted_at is null and p.status<>'cancelled'));
create policy revisions_handle on public.project_revision_requests for update to authenticated using(public.is_admin() and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null and p.deleted_at is null)) with check(public.is_admin() and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null and p.deleted_at is null));
-- Internal trigger serializes quota assignment. No callable privileged browser RPC.
create function renobva_private.guard_revision_request() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects;q public.project_quotes;used int;
begin
 select * into p from public.projects where id=new.project_id for update;
 if p.id is null or p.deleted_at is not null or p.archived_at is not null or p.status='cancelled' or auth.uid() is null then raise exception 'Project unavailable for revisions';end if;
 if TG_OP='INSERT' then
  if new.requested_by<>auth.uid() or p.user_id<>auth.uid() then raise exception 'Only the project client may request revisions';end if;
  select * into q from public.project_quotes where project_id=p.id and status='accepted' order by decided_at desc nulls last,created_at desc,id desc limit 1;
  if q.id is null or q.id<>new.quote_id then raise exception 'Accept the current proposal before requesting revisions';end if;
  select count(*) into used from public.project_revision_requests where quote_id=q.id and counts_allowance and status<>'declined';
  new.counts_allowance:=used<q.revisions+p.revision_bonus;
  new.status:=case when new.counts_allowance then 'pending' else 'extra_quote' end;
  new.response:='';new.created_at:=now();new.updated_at:=now();
 else
  if not public.is_admin() then raise exception 'Only admin may handle revisions';end if;
  if new.status is distinct from old.status then
   if old.status in ('completed','declined') then raise exception 'This revision is closed';end if;
   if old.status='extra_quote' and new.status in ('pending','in_progress','completed') then
    select * into q from public.project_quotes where id=old.quote_id;
    select count(*) into used from public.project_revision_requests where quote_id=q.id and counts_allowance and status<>'declined' and id<>old.id;
    if used>=q.revisions+p.revision_bonus then raise exception 'Grant an extra revision round before starting this request';end if;
    new.counts_allowance:=true;
   end if;
   if new.status='extra_quote' then raise exception 'Extra quote status is assigned automatically';end if;
  end if;
  new.updated_at:=now();
 end if;
 return new;
end;$$;
revoke all on function renobva_private.guard_revision_request() from public,anon,authenticated;
create trigger guard_revision_request before insert or update on public.project_revision_requests for each row execute function renobva_private.guard_revision_request();

create table public.delivery_decisions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,delivery_id uuid not null unique references public.project_deliveries(id) on delete cascade,client_id uuid not null references public.profiles(id),decision text not null check(decision in ('accepted','changes_requested')),feedback text not null default '' check(length(feedback)<=5000),created_at timestamptz not null default now(),check(decision<>'changes_requested' or length(trim(feedback))>=10));
create index delivery_decisions_project_idx on public.delivery_decisions(project_id);
create index delivery_decisions_client_idx on public.delivery_decisions(client_id);
alter table public.delivery_decisions enable row level security;
revoke all on public.delivery_decisions from public,anon,authenticated;
grant select on public.delivery_decisions to authenticated;
grant insert(project_id,delivery_id,client_id,decision,feedback) on public.delivery_decisions to authenticated;
create policy delivery_decisions_read on public.delivery_decisions for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy delivery_decisions_add on public.delivery_decisions for insert to authenticated with check(client_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.archived_at is null and p.deleted_at is null and p.status<>'cancelled'));
create function renobva_private.guard_delivery_decision() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects;latest uuid;q uuid;
begin
 select * into p from public.projects where id=new.project_id for update;
 if auth.uid() is null or p.user_id is distinct from auth.uid() or new.client_id<>auth.uid() or p.archived_at is not null or p.deleted_at is not null or p.status='cancelled' then raise exception 'Delivery unavailable';end if;
 select id into latest from public.project_deliveries where project_id=p.id order by created_at desc,id desc limit 1;
 if latest is distinct from new.delivery_id then raise exception 'Review the latest delivery instead';end if;
 new.created_at:=now();
 if new.decision='changes_requested' then
  select id into q from public.project_quotes where project_id=p.id and status='accepted' order by decided_at desc nulls last,created_at desc,id desc limit 1;
  if q is null then raise exception 'Agree a proposal before requesting delivery revisions';end if;
  insert into public.project_revision_requests(project_id,quote_id,requested_by,delivery_id,title,body) values(p.id,q,auth.uid(),new.delivery_id,'Final delivery changes',new.feedback);
 end if;
 return new;
end;$$;
revoke all on function renobva_private.guard_delivery_decision() from public,anon,authenticated;
create trigger guard_delivery_decision before insert on public.delivery_decisions for each row execute function renobva_private.guard_delivery_decision();
-- Existing design-change decisions also consume a round, without duplicating requests.
create function renobva_private.track_design_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare q uuid;
begin
 if new.status='changes_requested' and old.status='pending' then
  select id into q from public.project_quotes where project_id=new.project_id and status='accepted' order by decided_at desc nulls last,created_at desc,id desc limit 1;
  if q is not null then insert into public.project_revision_requests(project_id,quote_id,requested_by,review_id,title,body) values(new.project_id,q,auth.uid(),new.id,'Design changes: '||left(new.title,180),new.feedback);end if;
 end if;return new;
end;$$;
revoke all on function renobva_private.track_design_revision() from public,anon,authenticated;
create trigger track_design_revision after update on public.project_reviews for each row execute function renobva_private.track_design_revision();

create table public.maintenance_requests(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,client_id uuid not null references public.profiles(id),plan_name text not null,plan_scope text not null,amount numeric(10,2),status text not null default 'requested' check(status in ('requested','active','declined')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index maintenance_open_idx on public.maintenance_requests(project_id) where status in ('requested','active');
create index maintenance_client_idx on public.maintenance_requests(client_id);
alter table public.maintenance_requests enable row level security;
revoke all on public.maintenance_requests from public,anon,authenticated;
grant select on public.maintenance_requests to authenticated;
grant insert(project_id,client_id) on public.maintenance_requests to authenticated;
grant update(status) on public.maintenance_requests to authenticated;
create policy maintenance_read on public.maintenance_requests for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy maintenance_add on public.maintenance_requests for insert to authenticated with check(client_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.deleted_at is null and p.archived_at is null and p.status<>'cancelled'));
create policy maintenance_handle on public.maintenance_requests for update to authenticated using(public.is_admin() and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null and p.deleted_at is null)) with check(public.is_admin() and exists(select 1 from public.projects p where p.id=project_id and p.archived_at is null and p.deleted_at is null));
create function renobva_private.guard_maintenance_request() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects;h public.project_handover;
begin
 select * into p from public.projects where id=new.project_id for update;
 if auth.uid() is null or p.archived_at is not null or p.deleted_at is not null or p.status='cancelled' then raise exception 'Maintenance unavailable';end if;
 if TG_OP='INSERT' then
  if p.user_id is distinct from auth.uid() or new.client_id<>auth.uid() then raise exception 'Client access required';end if;
  select * into h from public.project_handover where project_id=p.id;
  if h.maintenance_status<>'offered' or length(trim(h.maintenance_name))=0 or h.project_id is null then raise exception 'No maintenance offer available';end if;
  new.plan_name:=h.maintenance_name;new.plan_scope:=h.maintenance_scope;new.amount:=h.maintenance_amount;new.status:='requested';new.created_at:=now();
 elsif not public.is_admin() then raise exception 'Admin access required';end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function renobva_private.guard_maintenance_request() from public,anon,authenticated;
create trigger guard_maintenance_request before insert or update on public.maintenance_requests for each row execute function renobva_private.guard_maintenance_request();

create table public.portal_onboarding(user_id uuid primary key references public.profiles(id) on delete cascade,completed_at timestamptz not null default now());
alter table public.portal_onboarding enable row level security;
revoke all on public.portal_onboarding from public,anon,authenticated;
grant select,insert,update on public.portal_onboarding to authenticated;
create policy onboarding_owner on public.portal_onboarding for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table public.project_testimonials(id uuid primary key default gen_random_uuid(),project_id uuid not null unique references public.projects(id) on delete cascade,client_id uuid not null references public.profiles(id),display_name text not null check(length(trim(display_name)) between 1 and 100),rating int not null check(rating between 1 and 5),body text not null check(length(trim(body)) between 10 and 1500),consent boolean not null default false,approved boolean not null default false,created_at timestamptz not null default now());
create index testimonials_client_idx on public.project_testimonials(client_id);
alter table public.project_testimonials enable row level security;
revoke all on public.project_testimonials from public,anon,authenticated;
grant select on public.project_testimonials to authenticated;
grant select(display_name,rating,body,created_at) on public.project_testimonials to anon;
grant insert(project_id,client_id,display_name,rating,body,consent) on public.project_testimonials to authenticated;
grant update(approved) on public.project_testimonials to authenticated;
grant delete on public.project_testimonials to authenticated;
create policy testimonials_public on public.project_testimonials for select to anon using(approved and consent);
create policy testimonials_private on public.project_testimonials for select to authenticated using(client_id=(select auth.uid()) or public.is_admin());
create policy testimonials_add on public.project_testimonials for insert to authenticated with check(client_id=(select auth.uid()) and not approved and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()) and p.deleted_at is null and (p.status='completed' or exists(select 1 from public.delivery_decisions d where d.project_id=p.id and d.decision='accepted'))));
create policy testimonials_approve on public.project_testimonials for update to authenticated using(public.is_admin() and consent) with check(public.is_admin() and consent);
create policy testimonials_remove on public.project_testimonials for delete to authenticated using(client_id=(select auth.uid()) or public.is_admin());

create table public.portal_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.profiles(id) on delete cascade,project_id uuid not null references public.projects(id) on delete cascade,event_key text not null,kind text not null check(kind in ('messages','payments','approvals','deliveries')),label text not null,tab text not null check(tab in ('overview','chat','files','payments','feedback','handover')),created_at timestamptz not null default now(),read_at timestamptz,unique(recipient_id,event_key));
create index notifications_recipient_idx on public.portal_notifications(recipient_id,created_at desc);
create index notifications_project_idx on public.portal_notifications(project_id);
alter table public.portal_notifications enable row level security;
revoke all on public.portal_notifications from public,anon,authenticated;
grant select on public.portal_notifications to authenticated;
grant update(read_at) on public.portal_notifications to authenticated;
create policy notifications_owner_read on public.portal_notifications for select to authenticated using(recipient_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy notifications_owner_mark on public.portal_notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
-- Same event stream for public navigation and portal. Trigger-only writer.
create function renobva_private.push_portal_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb;oldj jsonb;pid uuid;actor uuid;recipient uuid;category text;destination text;heading text;event text;
begin
 j:=to_jsonb(new);if TG_OP='UPDATE' then oldj:=to_jsonb(old);end if;
 pid:=case when TG_TABLE_NAME='projects' then (j->>'id')::uuid else (j->>'project_id')::uuid end;
 if TG_TABLE_NAME='projects' and TG_OP='UPDATE' and j->>'status' is not distinct from oldj->>'status' then return new;end if;
 if TG_OP='UPDATE' and TG_TABLE_NAME in ('payment_requests','project_quotes','project_reviews','project_revision_requests','maintenance_requests') and j->>'status' is not distinct from oldj->>'status' then return new;end if;
 actor:=case TG_TABLE_NAME when 'messages' then (j->>'sender_id')::uuid when 'workspace_files' then (j->>'uploaded_by')::uuid when 'project_comments' then (j->>'author_id')::uuid else auth.uid() end;
 category:=case when TG_TABLE_NAME in ('messages','workspace_files') then 'messages' when TG_TABLE_NAME='payment_requests' then 'payments' when TG_TABLE_NAME in ('project_deliveries','project_handover','delivery_decisions','maintenance_requests','project_testimonials') then 'deliveries' else 'approvals' end;
 destination:=case when TG_TABLE_NAME='messages' then 'chat' when TG_TABLE_NAME='workspace_files' then 'files' when TG_TABLE_NAME in ('payment_requests','project_quotes') then 'payments' when TG_TABLE_NAME in ('project_reviews','project_revision_requests','project_comments') then 'feedback' when category='deliveries' then 'handover' else 'overview' end;
 heading:=case TG_TABLE_NAME when 'projects' then case when TG_OP='INSERT' then 'New project request' else 'Project status: '||(j->>'status') end when 'messages' then 'New project message' when 'workspace_files' then 'New project file' when 'payment_requests' then 'Payment: '||(j->>'status') when 'project_quotes' then 'Proposal: '||(j->>'status') when 'project_reviews' then 'Design review: '||replace(j->>'status','_',' ') when 'project_revision_requests' then 'Revision: '||replace(j->>'status','_',' ') when 'project_comments' then 'New page feedback' when 'project_deliveries' then 'Final delivery ready for review' when 'delivery_decisions' then 'Delivery: '||replace(j->>'decision','_',' ') when 'maintenance_requests' then 'Maintenance: '||(j->>'status') when 'project_testimonials' then 'Client testimonial received' else 'Handover and maintenance updated' end;
 event:=TG_TABLE_NAME||':'||coalesce(j->>'id',j->>'project_id')||':'||coalesce(j->>'status',j->>'decision',j->>'updated_at',j->>'created_at');
 for recipient in select pr.id from public.profiles pr join public.projects p on p.id=pid where (pr.id=p.user_id or pr.role='admin') and pr.id is distinct from actor loop
  insert into public.portal_notifications(recipient_id,project_id,event_key,kind,label,tab) values(recipient,pid,event,category,heading,destination) on conflict do nothing;
  -- Existing legacy tables already have email triggers. New workflows use the same opt-in worker.
  if TG_TABLE_NAME in ('project_revision_requests','delivery_decisions','maintenance_requests','project_testimonials') and exists(select 1 from public.notification_preferences f where f.user_id=recipient and f.email and (to_jsonb(f)->>category)::boolean) then
   insert into public.workspace_email_queue(project_id,recipient_id,kind,label) values(pid,recipient,category,heading);
  end if;
 end loop;return new;
end;$$;
revoke all on function renobva_private.push_portal_notification() from public,anon,authenticated;
do $$declare tab text;begin
 foreach tab in array array['projects','messages','workspace_files','payment_requests','project_quotes','project_reviews','project_comments','project_deliveries','project_handover','project_revision_requests','delivery_decisions','maintenance_requests','project_testimonials'] loop
  execute format('create trigger %I after insert%s on public.%I for each row execute function renobva_private.push_portal_notification()',tab||'_portal_event',case when tab in ('projects','payment_requests','project_quotes','project_reviews','project_handover','project_revision_requests','maintenance_requests') then ' or update' else '' end,tab);
 end loop;
 foreach tab in array array['project_revision_requests','delivery_decisions','maintenance_requests','project_testimonials'] loop
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function renobva_private.record_project_activity()',tab||'_activity',tab);
 end loop;
end;$$;
-- Existing recent incoming messages and pending actions appear immediately, without sending emails.
insert into public.portal_notifications(recipient_id,project_id,event_key,kind,label,tab,created_at)
select pr.id,m.project_id,'messages:'||m.id||':'||m.created_at,'messages','New project message','chat',m.created_at from public.messages m join public.projects p on p.id=m.project_id join public.profiles pr on (pr.id=p.user_id or pr.role='admin') and pr.id<>m.sender_id where m.deleted_at is null and p.deleted_at is null and m.created_at>now()-interval '30 days' order by m.created_at desc limit 500 on conflict do nothing;
insert into public.portal_notifications(recipient_id,project_id,event_key,kind,label,tab,created_at)
select p.user_id,p.id,'project_quotes:'||q.id||':pending','approvals','Proposal awaiting your decision','payments',q.created_at from public.project_quotes q join public.projects p on p.id=q.project_id where q.status='pending' and p.deleted_at is null on conflict do nothing;
insert into public.portal_notifications(recipient_id,project_id,event_key,kind,label,tab,created_at)
select p.user_id,p.id,'payment_requests:'||r.id||':pending','payments','Payment requested','payments',r.created_at from public.payment_requests r join public.projects p on p.id=r.project_id where r.status='pending' and p.deleted_at is null on conflict do nothing;
create function renobva_private.maintenance_reminders() returns void language plpgsql security definer set search_path='' as $$
declare plan_row record;recipient uuid;added uuid;
begin
 for plan_row in select h.*,p.user_id from public.project_handover h join public.projects p on p.id=h.project_id where h.maintenance_status='active' and h.renewal_date is not null and h.renewal_date<=current_date+7 and p.archived_at is null and p.deleted_at is null and p.status<>'cancelled' loop
  for recipient in select id from public.profiles where id=plan_row.user_id or role='admin' loop
   added:=null;
   insert into public.portal_notifications(recipient_id,project_id,event_key,kind,label,tab) values(recipient,plan_row.project_id,'renewal:'||plan_row.project_id||':'||plan_row.renewal_date,'deliveries','Maintenance renewal due '||plan_row.renewal_date,'handover') on conflict do nothing returning id into added;
   if added is not null and exists(select 1 from public.notification_preferences f where f.user_id=recipient and f.email and f.deliveries) then insert into public.workspace_email_queue(project_id,recipient_id,kind,label) values(plan_row.project_id,recipient,'deliveries','Maintenance renewal due '||plan_row.renewal_date);end if;
  end loop;
 end loop;
end;$$;
revoke all on function renobva_private.maintenance_reminders() from public,anon,authenticated;
select cron.schedule('renobva-maintenance-reminders','0 7 * * *','select renobva_private.maintenance_reminders()');
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portal_notifications') then alter publication supabase_realtime add table public.portal_notifications;end if;
end;$$;
commit;
