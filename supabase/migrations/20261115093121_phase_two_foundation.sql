-- SERS uses its own names so it can coexist with an existing project.
create schema if not exists sers_private;
revoke all on schema sers_private from public, anon, authenticated;
grant usage on schema sers_private to authenticated;

create table sers_private.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique check (email = lower(trim(email)) and length(email) between 3 and 254),
  name text not null check (length(trim(name)) between 2 and 60),
  role text not null check (role in ('admin', 'responder')),
  category text check (category in ('Road Accident', 'Fire Outbreak')),
  callsign text not null default '' check (length(callsign) <= 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'admin' and category is null) or (role = 'responder' and category is not null))
);
alter table sers_private.accounts enable row level security;

create table public.sers_responders (
  id uuid primary key references sers_private.accounts(id),
  name text not null,
  callsign text not null,
  category text not null check (category in ('Road Accident', 'Fire Outbreak')),
  availability text not null default 'Off duty' check (availability in ('Available','On duty','Off duty')),
  active boolean not null default true,
  enrolled boolean not null default false
);
create table public.sers_incidents (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  category text not null check (category in ('Road Accident', 'Fire Outbreak')),
  title text not null check (length(trim(title)) between 5 and 100),
  description text not null check (length(trim(description)) between 10 and 2000),
  location text not null check (length(trim(location)) between 3 and 150),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  priority text not null check (priority in ('Critical','High','Medium','Low')),
  status text not null default 'Pending' check (status in ('Pending','Accepted','Responding','Resolved','Cancelled')),
  responder_id uuid references public.sers_responders(id),
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (status not in ('Accepted','Responding','Resolved') or responder_id is not null)
);
create unique index sers_one_active_assignment on public.sers_incidents(responder_id)
  where responder_id is not null and status in ('Pending','Accepted','Responding');
create index sers_incidents_team_date on public.sers_incidents(category, reported_at desc);
create index sers_incidents_status on public.sers_incidents(status);

create table public.sers_timeline (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.sers_incidents(id),
  actor_id uuid not null references sers_private.accounts(id),
  actor text not null,
  title text not null,
  detail text,
  kind text not null check (kind in ('status','assignment','note','report')),
  at timestamptz not null default now()
);
create index sers_timeline_incident on public.sers_timeline(incident_id, at);
create table public.sers_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references sers_private.accounts(id),
  incident_id uuid not null references public.sers_incidents(id),
  title text not null,
  at timestamptz not null default now(),
  read boolean not null default false
);
create index sers_notifications_account on public.sers_notifications(account_id, at desc);
create table sers_private.audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references sers_private.accounts(id),
  action text not null,
  target_id uuid,
  at timestamptz not null default now()
);
alter table sers_private.audit enable row level security;
create table public.sers_preferences (
  account_id uuid primary key references sers_private.accounts(id),
  dark boolean not null default false,
  notifications boolean not null default true
);

-- Privileged operations live outside the Data API. Every entry checks the
-- verified user and current membership; editable user_metadata is never trusted.
create function sers_private.current_account() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.id from sers_private.accounts a
  join auth.users u on u.id = a.user_id
  where a.user_id = (select auth.uid()) and a.active
    and u.email_confirmed_at is not null
    and exists (select 1 from auth.sessions s where s.user_id = u.id
      and s.id::text = (select auth.jwt()->>'session_id'))
$$;
create function sers_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from sers_private.accounts
    where id = sers_private.current_account() and role = 'admin')
$$;
create function sers_private.current_category() returns text
language sql stable security definer set search_path = '' as $$
  select category from sers_private.accounts where id = sers_private.current_account()
$$;
create function sers_private.account_json(a sers_private.accounts) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',a.id,'email',a.email,'name',a.name,'role',a.role,
    'category',a.category,'callsign',a.callsign,'active',a.active,'enrolled',a.user_id is not null)
$$;
create function sers_private.claim_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare account sers_private.accounts; verified_email text;
begin
  if auth.uid() is null then raise exception 'Sign in to continue.' using errcode = '42501'; end if;
  select lower(email) into verified_email from auth.users
    where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Confirm your email before signing in.' using errcode = '42501'; end if;
  select * into account from sers_private.accounts
    where email = verified_email and active for update;
  if account.id is null or (account.user_id is not null and account.user_id <> auth.uid()) then
    raise exception 'Your account has not been approved or is inactive. Contact your administrator.' using errcode = '42501';
  end if;
  if account.user_id is null then
    update sers_private.accounts set user_id = auth.uid() where id = account.id returning * into account;
    update public.sers_responders set enrolled = true where id = account.id;
    insert into sers_private.audit(actor_id,action,target_id) values(account.id,'Account activated',account.id);
  end if;
  if sers_private.current_account() is null then raise exception 'Your session has ended. Sign in again.' using errcode = '42501'; end if;
  return sers_private.account_json(account);
end; $$;
create function sers_private.account_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not sers_private.is_admin() then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(sers_private.account_json(a) order by a.created_at) from sers_private.accounts a),'[]'::jsonb);
end; $$;

alter table public.sers_responders enable row level security;
alter table public.sers_incidents enable row level security;
alter table public.sers_timeline enable row level security;
alter table public.sers_notifications enable row level security;
alter table public.sers_preferences enable row level security;
revoke all on public.sers_responders, public.sers_incidents, public.sers_timeline,
  public.sers_notifications, public.sers_preferences from anon, authenticated;
grant select on public.sers_responders, public.sers_incidents, public.sers_timeline,
  public.sers_notifications, public.sers_preferences to authenticated;
create policy sers_team_directory on public.sers_responders for select to authenticated
  using ((select sers_private.is_admin()) or category = (select sers_private.current_category()));
create policy sers_team_incidents on public.sers_incidents for select to authenticated
  using ((select sers_private.is_admin()) or category = (select sers_private.current_category()));
create policy sers_visible_timeline on public.sers_timeline for select to authenticated
  using (exists (select 1 from public.sers_incidents i where i.id = incident_id));
create policy sers_own_notifications on public.sers_notifications for select to authenticated
  using (account_id = (select sers_private.current_account()));
create policy sers_own_preferences on public.sers_preferences for select to authenticated
  using (account_id = (select sers_private.current_account()));

create function sers_private.mutate(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me sers_private.accounts; target sers_private.accounts; incident public.sers_incidents;
  responder public.sers_responders; target_id uuid; old_responder uuid;
  event_title text; event_detail text; event_kind text; next_status text;
begin
  select * into me from sers_private.accounts where id = sers_private.current_account();
  if me.id is null then raise exception 'Your account is inactive or your session has ended.' using errcode = '42501'; end if;
  -- Serialize dispatch decisions across callers. The unique index also prevents
  -- double assignments if another integration writes concurrently.
  perform pg_advisory_xact_lock(hashtextextended('sers:dispatch',0));
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

-- Public entry points use invoker security; only their private implementation
-- can write. Clients receive SELECT privileges, never arbitrary table UPDATE.
create function public.sers_claim_account() returns jsonb language sql security invoker set search_path = '' as $$
  select sers_private.claim_account()
$$;
create function public.sers_mutate(command text, payload jsonb) returns jsonb language sql security invoker set search_path = '' as $$
  select sers_private.mutate(command,payload)
$$;
create function public.sers_accounts() returns jsonb language sql security invoker set search_path = '' as $$
  select sers_private.account_list()
$$;
create function public.sers_snapshot() returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'incidents',coalesce((select jsonb_agg(i order by i.reported_at desc,i.number desc) from public.sers_incidents i),'[]'::jsonb),
    'responders',coalesce((select jsonb_agg(r order by r.name) from public.sers_responders r),'[]'::jsonb),
    'timeline',coalesce((select jsonb_agg(t order by t.at,t.id) from public.sers_timeline t),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(n order by n.at desc,n.id) from
      (select * from public.sers_notifications order by at desc,id limit 100) n),'[]'::jsonb),
    'preferences',(select row_to_json(p) from public.sers_preferences p)
  )
$$;

revoke all on all functions in schema sers_private from public, anon, authenticated;
grant execute on function sers_private.current_account(), sers_private.is_admin(), sers_private.current_category(),
  sers_private.claim_account(), sers_private.account_list(), sers_private.mutate(text,jsonb) to authenticated;
revoke all on function public.sers_claim_account(), public.sers_mutate(text,jsonb), public.sers_accounts(), public.sers_snapshot() from public, anon;
grant execute on function public.sers_claim_account(), public.sers_mutate(text,jsonb), public.sers_accounts(), public.sers_snapshot() to authenticated;
-- No demo incidents or sample responders are inserted into this database.
