begin;
-- Check payment dependencies in a trigger, not through a recursive project/payment RLS join.
alter policy projects_admin_delete on public.projects using(public.is_admin() and deleted_at is not null);
create function renobva_private.guard_permanent_project_delete() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.payment_documents where project_id=old.id) then raise exception 'Issued payment documents must be retained. Restore or archive this project.';end if;
 if exists(select 1 from public.payment_requests where project_id=old.id and stripe_locked and status not in ('paid','cancelled')) then raise exception 'A Stripe checkout is active. Resolve it before permanently deleting this project.';end if;
 return old;
end;$$;
revoke all on function renobva_private.guard_permanent_project_delete() from public,anon,authenticated;
create trigger guard_permanent_project_delete before delete on public.projects for each row execute function renobva_private.guard_permanent_project_delete();
commit;
