-- Guest reports use a random per-report capability, never a public incident list.
alter table public.sers_timeline alter column actor_id drop not null;
create table sers_private.guest_reports (
  incident_id uuid primary key references public.sers_incidents(id) on delete cascade,
  access_hash text not null check (access_hash ~ '^[0-9a-f]{64}$'),
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index sers_guest_device_date on sers_private.guest_reports(device_hash,created_at);
create index sers_guest_ip_date on sers_private.guest_reports(ip_hash,created_at);
alter table sers_private.guest_reports enable row level security;
create policy sers_guest_no_direct_access on sers_private.guest_reports for all to authenticated using(false) with check(false);
create table sers_private.guest_rate (
  ip_hash text not null,
  minute timestamptz not null,
  requests integer not null,
  primary key(ip_hash,minute)
);
alter table sers_private.guest_rate enable row level security;
create policy sers_guest_rate_no_access on sers_private.guest_rate for all to authenticated using(false) with check(false);
create index sers_guest_rate_date on sers_private.guest_rate(minute);
create table public.sers_citizen_contacts (
  incident_id uuid primary key references public.sers_incidents(id) on delete cascade,
  name text not null default '' check(length(name)<=60),
  phone text not null default '' check(length(phone)<=30),
  photo_path text
);
alter table public.sers_citizen_contacts enable row level security;
revoke all on public.sers_citizen_contacts from public,anon,authenticated;
grant select on public.sers_citizen_contacts to authenticated;
create policy sers_contacts_staff on public.sers_citizen_contacts for select to authenticated
  using (exists(select 1 from public.sers_incidents i where i.id=incident_id));

create function sers_private.guest_throttle(ip_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
  if ip_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  insert into sers_private.guest_rate values(ip_hash,date_trunc('minute',now()),1)
    on conflict on constraint guest_rate_pkey do update set requests=guest_rate.requests+1 returning requests into hits;
  delete from sers_private.guest_rate where minute < now()-interval '2 days';
  return hits <= 180;
end; $$;
create function public.sers_guest_throttle(ip_hash text) returns boolean
language sql security invoker set search_path='' as $$ select sers_private.guest_throttle(ip_hash) $$;

create function sers_private.guest_status(report_id uuid, access_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare report public.sers_incidents;
begin
  if access_hash !~ '^[0-9a-f]{64}$' or not exists(select 1 from sers_private.guest_reports g where g.incident_id=report_id and g.access_hash=guest_status.access_hash) then
    raise exception 'Report not found. Check your private tracking code.' using errcode='42501';
  end if;
  select * into report from public.sers_incidents where id=report_id;
  return jsonb_build_object('id',report.id,'reference','SERS-'||lpad(report.number::text,5,'0'),
    'category',report.category,'title',report.title,'description',report.description,'location',report.location,
    'latitude',report.latitude,'longitude',report.longitude,'status',report.status,'assigned',report.responder_id is not null,
    'reportedAt',report.reported_at,'updatedAt',report.updated_at,
    'photoAttached',exists(select 1 from public.sers_citizen_contacts c where c.incident_id=report_id and c.photo_path is not null),
    'timeline',coalesce((select jsonb_agg(jsonb_build_object('title',case when kind='assignment' then 'Responder assigned' else title end,'at',at) order by at,id)
      from public.sers_timeline where incident_id=report_id and kind in ('report','assignment','status')),'[]'::jsonb));
end; $$;
create function public.sers_guest_status(report_id uuid,access_hash text) returns jsonb
language sql security invoker set search_path='' as $$ select sers_private.guest_status(report_id,access_hash) $$;

create function sers_private.guest_submit(payload jsonb, access_hash text, device_hash text, ip_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare report_id uuid; report public.sers_incidents;
begin
  perform pg_advisory_xact_lock(hashtextextended('sers:guest-submit',0));
  report_id := (payload->>'id')::uuid;
  if access_hash !~ '^[0-9a-f]{64}$' or device_hash !~ '^[0-9a-f]{64}$' or ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid tracking credentials.'; end if;
  if exists(select 1 from public.sers_incidents where id=report_id) then
    return sers_private.guest_status(report_id,access_hash);
  end if;
  if (select count(*) from sers_private.guest_reports g where g.device_hash=guest_submit.device_hash and g.created_at>now()-interval '10 minutes')>=3 or
     (select count(*) from sers_private.guest_reports g where g.ip_hash=guest_submit.ip_hash and g.created_at>now()-interval '1 hour')>=20 then
    raise exception 'Reporting limit reached. Please wait before sending another report.' using errcode='P0001';
  end if;
  if coalesce(payload->>'category','') not in ('Road Accident','Fire Outbreak') or
    coalesce(length(trim(payload->>'title')),0) not between 5 and 100 or
    coalesce(length(trim(payload->>'description')),0) not between 10 and 2000 or
    coalesce(length(trim(payload->>'location')),0) not between 3 and 150 or
    coalesce(length(payload->>'name'),0)>60 or coalesce(length(payload->>'phone'),0)>30 or
    payload->>'latitude' is null or payload->>'longitude' is null then raise exception 'Check the report details and choose a location.'; end if;
  insert into public.sers_incidents(id,category,title,description,location,priority,latitude,longitude)
    values(report_id,payload->>'category',trim(payload->>'title'),trim(payload->>'description'),trim(payload->>'location'),'High',
    (payload->>'latitude')::double precision,(payload->>'longitude')::double precision) returning * into report;
  insert into sers_private.guest_reports values(report_id,access_hash,device_hash,ip_hash,now());
  insert into public.sers_citizen_contacts(incident_id,name,phone) values(report_id,trim(coalesce(payload->>'name','')),trim(coalesce(payload->>'phone','')));
  insert into public.sers_timeline(incident_id,actor_id,actor,title,kind) values(report_id,null,'Public reporter','Citizen report received','report');
  insert into public.sers_notifications(account_id,incident_id,title)
    select id,report_id,'New citizen report: '||report.title from sers_private.accounts
    where active and user_id is not null and (role='admin' or report.category=any(categories));
  return sers_private.guest_status(report_id,access_hash);
end; $$;
create function public.sers_guest_submit(payload jsonb,access_hash text,device_hash text,ip_hash text) returns jsonb
language sql security invoker set search_path='' as $$ select sers_private.guest_submit(payload,access_hash,device_hash,ip_hash) $$;

create function sers_private.guest_photo(report_id uuid,access_hash text,photo_path text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform sers_private.guest_status(report_id,access_hash);
  if photo_path <> report_id::text||'/scene' then raise exception 'Invalid photo path.'; end if;
  update public.sers_citizen_contacts c set photo_path=guest_photo.photo_path where c.incident_id=report_id;
end; $$;
create function public.sers_guest_photo(report_id uuid,access_hash text,photo_path text) returns void
language sql security invoker set search_path='' as $$ select sers_private.guest_photo(report_id,access_hash,photo_path) $$;

-- Only the Edge Function's server key can call these APIs. No public RPC bypass.
revoke all on function sers_private.guest_throttle(text),sers_private.guest_status(uuid,text),sers_private.guest_submit(jsonb,text,text,text),sers_private.guest_photo(uuid,text,text),
 public.sers_guest_throttle(text),public.sers_guest_status(uuid,text),public.sers_guest_submit(jsonb,text,text,text),public.sers_guest_photo(uuid,text,text) from public,anon,authenticated;
grant usage on schema sers_private to service_role;
grant execute on function sers_private.guest_throttle(text),sers_private.guest_status(uuid,text),sers_private.guest_submit(jsonb,text,text,text),sers_private.guest_photo(uuid,text,text),
 public.sers_guest_throttle(text),public.sers_guest_status(uuid,text),public.sers_guest_submit(jsonb,text,text,text),public.sers_guest_photo(uuid,text,text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('sers-citizen-photos','sers-citizen-photos',false,3145728,array['image/jpeg','image/png','image/webp']);
