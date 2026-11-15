create function sers_private.authorize_account_link(account_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('sers:dispatch',0));
  me := sers_private.current_account();
  if not sers_private.is_admin() or me is null then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if not exists(select 1 from sers_private.accounts where id=account_id and active) then raise exception 'Choose an approved account.' using errcode='42501'; end if;
  if exists(select 1 from sers_private.audit where target_id=account_id and action='Private account link requested' and at > now() - interval '30 seconds') then
    raise exception 'Wait 30 seconds before creating another account link.';
  end if;
  insert into sers_private.audit(actor_id,action,target_id) values(me,'Private account link requested',account_id);
end; $$;
create function public.sers_authorize_account_link(account_id uuid) returns void
language sql security invoker set search_path = '' as $$ select sers_private.authorize_account_link(account_id) $$;
revoke all on function sers_private.authorize_account_link(uuid),public.sers_authorize_account_link(uuid) from public,anon;
grant execute on function sers_private.authorize_account_link(uuid),public.sers_authorize_account_link(uuid) to authenticated;
