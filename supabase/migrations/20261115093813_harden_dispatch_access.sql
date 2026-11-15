-- Explicit deny policies document private tables' access model.
create policy sers_accounts_no_direct_access on sers_private.accounts for all to authenticated using (false) with check (false);
create policy sers_audit_no_direct_access on sers_private.audit for all to authenticated using (false) with check (false);
create index sers_timeline_actor on public.sers_timeline(actor_id);
create index sers_notifications_incident on public.sers_notifications(incident_id);
create index sers_incidents_responder on public.sers_incidents(responder_id);
create index sers_audit_actor on sers_private.audit(actor_id);

create or replace function sers_private.mutate(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me sers_private.accounts; target sers_private.accounts; incident public.sers_incidents;
  responder public.sers_responders; target_id uuid; old_responder uuid;
  event_title text; event_detail text; event_kind text; next_status text;
begin
  -- Serialize dispatch decisions across callers. The unique index also prevents
  -- double assignments if another integration writes concurrently.
  perform pg_advisory_xact_lock(hashtextextended('sers:dispatch',0));
  select * into me from sers_private.accounts where id = sers_private.current_account();
  if me.id is null then raise exception 'Your account is inactive or your session has ended.' using errcode = '42501'; end if;
  if command = 'approve_account' then
    if me.role <> 'admin' then raise exception 'Only administrators can approve accounts.' using errcode = '42501'; end if;
    if length(trim(payload->>'name')) not between 2 and 60 or
       length(trim(payload->>'email')) not between 3 and 254 or
       payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
       payload->>'role' not in ('admin','responder') or
       length(trim(payload->>'callsign')) > 30 then raise exception 'Enter a valid name, email, role and call sign.'; end if;
    insert into sers_private.accounts(email,name,role,category,callsign)
      values(lower(trim(payload->>'email')),trim(payload->>'name'),payload->>'role',
        case when payload->>'role' = 'responder' then payload->>'category' end,trim(coalesce(payload->>'callsign','')))
      returning * into target;
    if target.role = 'responder' then
      insert into public.sers_responders(id,name,callsign,category)
        values(target.id,target.name,target.callsign,target.category);
    end if;
    insert into sers_private.audit(actor_id,action,target_id) values(me.id,'Account approved',target.id);
    return jsonb_build_object('ok',true);
  elsif command = 'preferences' then
    insert into public.sers_preferences(account_id,dark,notifications)
      values(me.id,coalesce((payload->>'dark')::boolean,false),coalesce((payload->>'notifications')::boolean,true))
      on conflict(account_id) do update set
        dark = coalesce((payload->>'dark')::boolean,sers_preferences.dark),
        notifications = coalesce((payload->>'notifications')::boolean,sers_preferences.notifications);
    return jsonb_build_object('ok',true);
  elsif command = 'read_notifications' then
    update public.sers_notifications set read = true where account_id = me.id and not read;
    return jsonb_build_object('ok',true);
  elsif command in ('availability','active') then
    target_id := (payload->>'id')::uuid;
    select * into target from sers_private.accounts where id = target_id for update;
    if target.id is null or (me.role <> 'admin' and (command <> 'availability' or me.id <> target.id)) then
      raise exception 'You cannot change this account.' using errcode = '42501'; end if;
    if command = 'active' then
      if target.id = me.id then raise exception 'You cannot deactivate your own administrator account.'; end if;
      if not (payload->>'active')::boolean and exists (select 1 from public.sers_incidents where responder_id = target.id and status in ('Pending','Accepted','Responding')) then
        raise exception 'Reassign or close the active incident before deactivating this account.'; end if;
      update sers_private.accounts set active = (payload->>'active')::boolean where id = target.id;
      update public.sers_responders set active = (payload->>'active')::boolean where id = target.id;
    else
      if target.role <> 'responder' or not target.active or target.user_id is null then raise exception 'An active responder account is required.'; end if;
      if payload->>'availability' not in ('Available','On duty','Off duty') then raise exception 'Select a valid availability.'; end if;
      if payload->>'availability' <> 'On duty' and exists(select 1 from public.sers_incidents where responder_id = target.id and status in ('Pending','Accepted','Responding')) then
        raise exception 'Finish your active assignment before changing availability.'; end if;
      update public.sers_responders set availability = payload->>'availability' where id = target.id;
    end if;
    insert into sers_private.audit(actor_id,action,target_id) values(me.id,command || ' changed',target.id);
    return jsonb_build_object('ok',true);
  elsif command = 'report' then
    if me.role <> 'admin' then raise exception 'Only administrators can record incidents.' using errcode = '42501'; end if;
    target_id := (payload->>'id')::uuid;
    if exists(select 1 from public.sers_incidents where id = target_id) then
      return jsonb_build_object('ok',true,'incidentId',target_id);
    end if;
    insert into public.sers_incidents(id,category,title,description,location,priority,latitude,longitude)
      values(target_id,payload->>'category',trim(payload->>'title'),trim(payload->>'description'),trim(payload->>'location'),payload->>'priority',
        (payload->>'latitude')::double precision,(payload->>'longitude')::double precision)
      returning * into incident;
    event_title := 'Incident recorded'; event_kind := 'report';
  elsif command in ('assign','transition','note') then
    select * into incident from public.sers_incidents where id = (payload->>'id')::uuid for update;
    if incident.id is null or (me.role <> 'admin' and (me.category <> incident.category or me.id is distinct from incident.responder_id)) then
      raise exception 'You can only update your own assignments.' using errcode = '42501'; end if;
    if incident.status in ('Resolved','Cancelled') then raise exception 'Closed incidents cannot be changed.'; end if;
    if command = 'assign' then
      if me.role <> 'admin' then raise exception 'Only administrators can assign responders.' using errcode = '42501'; end if;
      if incident.status <> 'Pending' then raise exception 'Only pending incidents can be reassigned.'; end if;
      select * into responder from public.sers_responders where id = (payload->>'responderId')::uuid for update;
      if responder.id is null or not responder.active or not responder.enrolled or responder.category <> incident.category or responder.availability = 'Off duty' then
        raise exception 'Choose an activated, on-duty responder from the correct team.'; end if;
      if exists(select 1 from public.sers_incidents where id <> incident.id and responder_id = responder.id and status in ('Pending','Accepted','Responding')) then
        raise exception 'This responder already has an active assignment.'; end if;
      old_responder := incident.responder_id;
      update public.sers_incidents set responder_id = responder.id where id = incident.id;
      update public.sers_responders set availability = 'On duty' where id = responder.id;
      event_title := 'Assigned to ' || responder.name; event_kind := 'assignment';
    elsif command = 'transition' then
      next_status := payload->>'status';
      if next_status = 'Cancelled' then
        if me.role <> 'admin' then raise exception 'Only administrators can cancel incidents.' using errcode = '42501'; end if;
        if coalesce(length(trim(payload->>'reason')),0) not between 5 and 500 then raise exception 'Enter a cancellation reason between 5 and 500 characters.'; end if;
        event_detail := trim(payload->>'reason');
      else
        if next_status is distinct from (case incident.status when 'Pending' then 'Accepted' when 'Accepted' then 'Responding' when 'Responding' then 'Resolved' end) then
          raise exception 'Invalid status transition. Refresh to see the current status.'; end if;
        if not exists(select 1 from public.sers_responders where id = incident.responder_id and active and enrolled) then
          raise exception 'Assign an active responder before accepting the incident.'; end if;
      end if;
      update public.sers_incidents set status = next_status where id = incident.id;
      if next_status in ('Resolved','Cancelled') then old_responder := incident.responder_id; end if;
      event_title := 'Status changed to ' || lower(next_status); event_kind := 'status';
    else
      if coalesce(length(trim(payload->>'note')),0) not between 3 and 1000 then raise exception 'Write a note between 3 and 1,000 characters.'; end if;
      event_title := 'Response note added'; event_detail := trim(payload->>'note'); event_kind := 'note';
    end if;
    update public.sers_incidents set updated_at = now() where id = incident.id;
  else raise exception 'Unknown operation.';
  end if;
  if old_responder is not null and not exists(select 1 from public.sers_incidents where responder_id = old_responder and status in ('Pending','Accepted','Responding')) then
    update public.sers_responders set availability = 'Available' where id = old_responder;
  end if;
  insert into public.sers_timeline(incident_id,actor_id,actor,title,detail,kind)
    values(incident.id,me.id,me.name,event_title,event_detail,event_kind);
  insert into public.sers_notifications(account_id,incident_id,title)
    select id,incident.id,event_title from sers_private.accounts
    where active and user_id is not null and (role = 'admin' or category = incident.category);
  insert into sers_private.audit(actor_id,action,target_id) values(me.id,event_title,incident.id);
  return jsonb_build_object('ok',true,'incidentId',incident.id);
exception when unique_violation then raise exception 'This account or assignment already exists. Refresh and try again.';
end; $$;
