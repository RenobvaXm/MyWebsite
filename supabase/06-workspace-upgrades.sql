begin;
create schema if not exists renobva_private;
revoke all on schema renobva_private from public,anon,authenticated;
create table public.project_milestones(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,title text not null check(length(title) between 3 and 200),description text not null default '' check(length(description)<=5000),due_date date,status text not null default 'planned' check(status in ('planned','in_progress','completed')),position int not null default 0,created_at timestamptz not null default now());
create table public.workspace_files(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,uploaded_by uuid not null references public.profiles(id),category text not null check(category in ('Logos','Content','Designs','Final Files')),attachment_path text not null unique,attachment_name text not null check(length(attachment_name) between 1 and 255),attachment_type text,attachment_size bigint not null check(attachment_size between 1 and 15728640),created_at timestamptz not null default now(),check(attachment_path like project_id::text||'/library/%'));
create table public.project_comments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,author_id uuid not null references public.profiles(id),page_url text not null check(page_url ~ '^https://'),section text not null check(length(section) between 1 and 200),body text not null check(length(body) between 3 and 5000),resolved boolean not null default false,created_at timestamptz not null default now());
create table public.project_handover(project_id uuid primary key references public.projects(id) on delete cascade,website_url text check(website_url ~ '^https://'),instructions text not null default '' check(length(instructions)<=10000),support text not null default '' check(length(support)<=5000),maintenance_name text not null default '' check(length(maintenance_name)<=120),maintenance_amount numeric(10,2) check(maintenance_amount>=0),maintenance_scope text not null default '' check(length(maintenance_scope)<=5000),maintenance_status text not null default 'none' check(maintenance_status in ('none','offered','active')),updated_at timestamptz not null default now());
create table public.notification_preferences(user_id uuid primary key references public.profiles(id) on delete cascade,messages boolean not null default true,payments boolean not null default true,approvals boolean not null default true,deliveries boolean not null default true,email boolean not null default false);
create table public.billing_profiles(user_id uuid primary key references public.profiles(id) on delete cascade,legal_name text not null default '' check(length(legal_name)<=200),address text not null default '' check(length(address)<=1000),tax_id text not null default '' check(length(tax_id)<=100));
create table public.business_billing(id boolean primary key default true check(id),legal_name text not null default '',address text not null default '',tax_id text not null default '',tax_note text not null default '',updated_at timestamptz not null default now());
insert into public.business_billing(id,legal_name) values(true,'RENOBVA');
create table public.payment_documents(id uuid primary key default gen_random_uuid(),payment_id uuid not null unique references public.payment_requests(id),project_id uuid not null references public.projects(id),client_id uuid not null references public.profiles(id),number bigint generated always as identity unique,description text not null,amount numeric(10,2) not null,currency text not null,issued_at timestamptz not null default now(),seller jsonb not null,buyer jsonb not null,document_type text not null check(document_type in ('invoice','receipt')));
create table public.project_templates(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 3 and 120),milestones jsonb not null check(jsonb_typeof(milestones)='array' and jsonb_array_length(milestones)<=20),tasks jsonb not null check(jsonb_typeof(tasks)='array' and jsonb_array_length(tasks)<=30),questions text not null default '' check(length(questions)<=5000));
insert into public.project_templates(title,milestones,tasks,questions) values
('Business website','["Brief & content","Design concept","Development","Client review","Launch & handover"]','["Confirm scope and content","Collect branding","Check mobile layout","Test forms and links","Prepare handover"]','Who is your target audience? Which pages do you need? What action should visitors take?'),
('Restaurant website','["Menu & booking brief","Design concept","Menu and booking setup","Client review","Launch"]','["Collect menu, hours and address","Confirm reservation process","Optimize food images","Test booking form"]','Do you need table reservations? Who receives booking emails? Do you have menu photos and allergy information?'),
('Birthday website','["Story & media","Visual concept","Games and memories","Private preview","Delivery"]','["Confirm date and recipient","Collect approved photos and audio","Test audio on mobile","Check surprise gate"]','What is the celebration date? Which memories and music should be included? Should the site be private?');
alter table public.project_milestones enable row level security;
revoke all on public.project_milestones from anon,authenticated;
create policy project_milestones_read on public.project_milestones for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
grant select,insert,update,delete on public.project_milestones to authenticated;
create policy project_milestones_admin on public.project_milestones for all to authenticated using(public.is_admin()) with check(public.is_admin());
create index project_milestones_project_idx on public.project_milestones(project_id);
alter table public.workspace_files enable row level security;
revoke all on public.workspace_files from anon,authenticated;
create policy workspace_files_read on public.workspace_files for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
grant select,insert,delete on public.workspace_files to authenticated;
create policy workspace_files_add on public.workspace_files for insert to authenticated with check(uploaded_by=(select auth.uid()) and (public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))));
create policy workspace_files_delete on public.workspace_files for delete to authenticated using(public.is_admin() or (uploaded_by=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))));
grant update(category) on public.workspace_files to authenticated;
create policy workspace_files_move on public.workspace_files for update to authenticated using(public.is_admin() or (uploaded_by=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())))) with check(public.is_admin() or uploaded_by=(select auth.uid()));
create index workspace_files_project_idx on public.workspace_files(project_id);
alter table public.project_comments enable row level security;
revoke all on public.project_comments from anon,authenticated;
create policy project_comments_read on public.project_comments for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
grant select,insert,delete on public.project_comments to authenticated;
create policy project_comments_add on public.project_comments for insert to authenticated with check(author_id=(select auth.uid()) and (public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))));
create policy project_comments_delete on public.project_comments for delete to authenticated using(public.is_admin() or (author_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid()))));
grant update(resolved) on public.project_comments to authenticated;
create policy project_comments_resolve on public.project_comments for update to authenticated using(public.is_admin()) with check(public.is_admin());
create index project_comments_project_idx on public.project_comments(project_id);
alter table public.project_handover enable row level security;
revoke all on public.project_handover from anon,authenticated;
create policy project_handover_read on public.project_handover for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=(select auth.uid())));
grant select,insert,update,delete on public.project_handover to authenticated;
create policy project_handover_admin on public.project_handover for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
create policy notification_preferences_owner on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.billing_profiles enable row level security;
revoke all on public.billing_profiles from anon,authenticated;
grant select,insert,update on public.billing_profiles to authenticated;
create policy billing_profiles_owner on public.billing_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy billing_profiles_admin_read on public.billing_profiles for select to authenticated using(public.is_admin());
alter table public.business_billing enable row level security;
revoke all on public.business_billing from anon,authenticated;
grant select,insert,update,delete on public.business_billing to authenticated;
create policy business_billing_admin on public.business_billing for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.project_templates enable row level security;
revoke all on public.project_templates from anon,authenticated;
grant select,insert,update,delete on public.project_templates to authenticated;
create policy project_templates_admin on public.project_templates for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.payment_documents enable row level security;
revoke all on public.payment_documents from anon,authenticated;
grant select on public.payment_documents to authenticated;
create policy payment_documents_read on public.payment_documents for select to authenticated using(public.is_admin() or client_id=(select auth.uid()));
create index payment_documents_project_idx on public.payment_documents(project_id);
-- Immutable snapshots: runs only on trusted payment confirmation, never from browser prices.
create function renobva_private.issue_payment_document() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and (TG_OP='INSERT' or old.status is distinct from 'paid') then
 insert into public.payment_documents(payment_id,project_id,client_id,description,amount,currency,seller,buyer,document_type)
 select new.id,new.project_id,new.client_id,new.title,new.amount,new.currency,to_jsonb(s),coalesce((select to_jsonb(b) from public.billing_profiles b where b.user_id=new.client_id),'{}'::jsonb),case when length(trim(s.legal_name))>0 and length(trim(s.address))>0 and exists(select 1 from public.billing_profiles b where b.user_id=new.client_id and length(trim(b.legal_name))>0 and length(trim(b.address))>0) then 'invoice' else 'receipt' end from public.business_billing s where s.id=true
 on conflict(payment_id) do nothing;
 end if;
 return new;
end;$$;
revoke all on function renobva_private.issue_payment_document() from public,anon,authenticated;
create trigger issue_payment_document after insert or update of status on public.payment_requests for each row execute function renobva_private.issue_payment_document();
-- Backfill confirmed payments as receipts/invoices without notifying clients.
insert into public.payment_documents(payment_id,project_id,client_id,description,amount,currency,issued_at,seller,buyer,document_type)
select p.id,p.project_id,p.client_id,p.title,p.amount,p.currency,coalesce(p.paid_at,p.updated_at),to_jsonb(s),coalesce((select to_jsonb(b) from public.billing_profiles b where b.user_id=p.client_id),'{}'::jsonb),'receipt'
from public.payment_requests p cross join public.business_billing s where p.status='paid' on conflict(payment_id) do nothing;
create function public.apply_project_template(target_project uuid,template_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare t public.project_templates; item text; n int:=0;
begin
 if not public.is_admin() then raise exception 'Admin access required';end if;
 select * into strict t from public.project_templates where id=template_id;
 if exists(select 1 from public.project_milestones where project_id=target_project) then raise exception 'This project already has milestones. Edit them or clear them before applying a template.';end if;
 for item in select jsonb_array_elements_text(t.milestones) loop
 insert into public.project_milestones(project_id,title,position) values(target_project,item,n);n:=n+1;
 end loop;
 for item in select jsonb_array_elements_text(t.tasks) loop
 insert into public.project_tasks(project_id,title,notes,created_by) values(target_project,item,'',auth.uid());
 end loop;
 if length(t.questions)>0 then insert into public.project_tasks(project_id,title,notes,created_by) values(target_project,'Clarify the project brief',t.questions,auth.uid());end if;
end;$$;
revoke all on function public.apply_project_template(uuid,uuid) from public,anon;
grant execute on function public.apply_project_template(uuid,uuid) to authenticated;
commit;
