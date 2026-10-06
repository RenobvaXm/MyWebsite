-- Reference: these changes are already applied to the connected database.
revoke insert on public.projects from authenticated,anon;
revoke update on public.projects from authenticated;
grant update(status,updated_at) on public.projects to authenticated;
revoke update on public.messages from authenticated;
grant update(body,edited_at,deleted_at,attachment_path,attachment_name,attachment_type,attachment_size) on public.messages to authenticated;
revoke insert on public.contact_requests from anon,authenticated;
create or replace function public.chat_profile(p_project uuid,p_user uuid)
returns table(id uuid,display_name text,role text,avatar_url text)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.projects x where x.id=p_project and (x.user_id=auth.uid() or public.is_admin())) then raise exception 'Access denied'; end if;
 return query select p.id,p.display_name,p.role,p.avatar_url from public.profiles p where p.id=p_user and (p.role='admin' or exists(select 1 from public.projects x where x.id=p_project and x.user_id=p.id));
end $$;
revoke all on function public.chat_profile(uuid,uuid) from public,anon;
grant execute on function public.chat_profile(uuid,uuid) to authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.protect_project_client_updates() from public,anon,authenticated;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.project_is_open(uuid) from public,anon;
grant execute on function public.project_is_open(uuid) to authenticated;
