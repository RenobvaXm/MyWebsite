begin;
alter table public.projects add column archived_at timestamptz,add column deleted_at timestamptz;
create index projects_lifecycle_idx on public.projects(deleted_at,archived_at);
alter policy projects_read on public.projects using(public.is_admin() or (user_id=(select auth.uid()) and deleted_at is null));
alter policy projects_admin_delete on public.projects using(public.is_admin() and deleted_at is not null and not exists(select 1 from public.payment_documents d where d.project_id=projects.id));
create function renobva_private.protect_project_lifecycle() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_admin() and (new.archived_at is distinct from old.archived_at or new.deleted_at is distinct from old.deleted_at) then raise exception 'Only admin can archive or trash projects';end if;
 return new;
end;$$;
revoke all on function renobva_private.protect_project_lifecycle() from public,anon,authenticated;
create trigger protect_project_lifecycle before update on public.projects for each row execute function renobva_private.protect_project_lifecycle();
-- Existing chat write policies use this helper; archived and trashed projects are now read-only.
create or replace function public.project_is_open(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects where id=pid and status not in ('completed','cancelled') and archived_at is null and deleted_at is null and (user_id=auth.uid() or public.is_admin()));
$$;
create table public.project_read_receipts(project_id uuid not null references public.projects(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,last_read_at timestamptz not null default '1970-01-01',primary key(project_id,user_id),check(last_read_at<=now()+interval '5 seconds'));
alter table public.project_read_receipts enable row level security;
revoke all on public.project_read_receipts from public,anon,authenticated;
grant select,insert,update on public.project_read_receipts to authenticated;
create policy project_receipts_read on public.project_read_receipts for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy project_receipts_insert on public.project_read_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create policy project_receipts_update on public.project_read_receipts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id and (p.user_id=(select auth.uid()) or public.is_admin())));
create index project_receipts_user_idx on public.project_read_receipts(user_id,project_id);
create function public.mark_project_read(target_project uuid,last_message uuid) returns void language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select created_at into stamp from public.messages where id=last_message and project_id=target_project;
 if stamp is null then raise exception 'Message unavailable';end if;
 insert into public.project_read_receipts(project_id,user_id,last_read_at) values(target_project,auth.uid(),stamp) on conflict(project_id,user_id) do update set last_read_at=greatest(project_read_receipts.last_read_at,excluded.last_read_at);
end;$$;
revoke all on function public.mark_project_read(uuid,uuid) from public,anon;
grant execute on function public.mark_project_read(uuid,uuid) to authenticated;
create table public.project_activity(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete cascade,actor_id uuid references public.profiles(id) on delete set null,event text not null,detail jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
alter table public.project_activity enable row level security;
revoke all on public.project_activity from public,anon,authenticated;
grant select on public.project_activity to authenticated;
create policy project_activity_admin_read on public.project_activity for select to authenticated using(public.is_admin());
create index project_activity_project_date_idx on public.project_activity(project_id,created_at desc);
-- Trigger-only writer in an unexposed schema. Browsers cannot forge or edit history.
create function renobva_private.record_project_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb;after_row jsonb;project uuid;label text;details jsonb;
begin
 if TG_OP='DELETE' then after_row:=to_jsonb(old);else after_row:=to_jsonb(new);end if;
 if TG_OP='UPDATE' then before_row:=to_jsonb(old);end if;
 project:=case when TG_TABLE_NAME='projects' then (after_row->>'id')::uuid else (after_row->>'project_id')::uuid end;
 if not exists(select 1 from public.projects where id=project) then return coalesce(new,old);end if;
 if TG_TABLE_NAME='projects' then
  if TG_OP='INSERT' then label:='Project created';
  elsif after_row->>'deleted_at' is distinct from before_row->>'deleted_at' then label:=case when after_row->>'deleted_at' is null then 'Project restored from Trash' else 'Project moved to Trash' end;
  elsif after_row->>'archived_at' is distinct from before_row->>'archived_at' then label:=case when after_row->>'archived_at' is null then 'Project unarchived' else 'Project archived' end;
  elsif after_row->>'status' is distinct from before_row->>'status' then label:='Project status changed';else return new;end if;
 elsif TG_TABLE_NAME in ('project_quotes','project_reviews','payment_requests') then
  if TG_OP='UPDATE' and after_row->>'status' is not distinct from before_row->>'status' then return new;end if;
  label:=case TG_TABLE_NAME when 'project_quotes' then 'Quote' when 'project_reviews' then 'Design review' else 'Payment' end||case when TG_OP='INSERT' then ' created' else ' updated' end;
 else label:=replace(TG_TABLE_NAME,'project_','')||' '||lower(TG_OP);end if;
 details:=jsonb_strip_nulls(jsonb_build_object('title',after_row->>'title','status',after_row->>'status','previous_status',before_row->>'status','amount',after_row->>'amount','currency',after_row->>'currency','due_date',after_row->>'due_date','item_id',after_row->>'id'));
 insert into public.project_activity(project_id,actor_id,event,detail) values(project,auth.uid(),label,details);
 return coalesce(new,old);
end;$$;
revoke all on function renobva_private.record_project_activity() from public,anon,authenticated;
create trigger projects_activity after insert or update on public.projects for each row execute function renobva_private.record_project_activity();
create trigger project_quotes_activity after insert or update or delete on public.project_quotes for each row execute function renobva_private.record_project_activity();
create trigger project_reviews_activity after insert or update or delete on public.project_reviews for each row execute function renobva_private.record_project_activity();
create trigger payment_requests_activity after insert or update or delete on public.payment_requests for each row execute function renobva_private.record_project_activity();
create trigger project_milestones_activity after insert or update or delete on public.project_milestones for each row execute function renobva_private.record_project_activity();
create trigger project_deliveries_activity after insert or update or delete on public.project_deliveries for each row execute function renobva_private.record_project_activity();
create trigger project_handover_activity after insert or update or delete on public.project_handover for each row execute function renobva_private.record_project_activity();
commit;
grant update(archived_at,deleted_at) on public.projects to authenticated;
alter policy projects_insert on public.projects with check(user_id=(select auth.uid()) and not public.is_admin() and archived_at is null and deleted_at is null);
