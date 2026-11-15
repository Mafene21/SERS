-- Public reporting is deliberately isolated from dashboard writes and reads.
-- Anonymous users can call only the narrow submit/track/upload-ticket RPCs.

create extension if not exists pgcrypto with schema extensions;

create table sers_private.public_reporters (
  incident_id uuid primary key references public.sers_incidents(id) on delete cascade,
  reference text not null unique,
  reporter_name text not null check (length(trim(reporter_name)) between 2 and 60),
  contact_phone text not null check (length(trim(contact_phone)) between 7 and 25),
  access_token_hash text not null unique check (access_token_hash ~ '^[a-f0-9]{64}$'),
  photo_path text unique,
  created_at timestamptz not null default now()
);

create table sers_private.public_upload_tickets (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 3145728),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create table sers_private.public_evidence (
  path text primary key,
  ticket_id uuid not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 3145728),
  image_data bytea not null,
  created_at timestamptz not null default now(),
  check (octet_length(image_data) = byte_size),
  check (
    (content_type = 'image/jpeg' and substring(image_data from 1 for 3) = decode('ffd8ff','hex')) or
    (content_type = 'image/png' and substring(image_data from 1 for 8) = decode('89504e470d0a1a0a','hex')) or
    (content_type = 'image/webp' and substring(image_data from 1 for 4) = convert_to('RIFF','UTF8')
      and substring(image_data from 9 for 4) = convert_to('WEBP','UTF8'))
  )
);

create table sers_private.public_report_events (
  incident_id uuid not null references public.sers_incidents(id) on delete cascade,
  sequence smallint not null check (sequence in (1,2)),
  title text not null check (title in ('Report submitted','Report received')),
  at timestamptz not null,
  primary key (incident_id, sequence)
);

revoke all on sers_private.public_reporters, sers_private.public_upload_tickets,
  sers_private.public_evidence, sers_private.public_report_events
  from public, anon, authenticated;

-- Public reports are created without a responder account. The incident itself
-- remains in the existing shared table, while its contact details stay private.

create or replace function sers_private.public_access_hash(p_token text)
returns text
language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function sers_private.create_public_upload_ticket(
  p_content_type text,
  p_size integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ticket_id uuid;
  extension text;
  object_path text;
begin
  delete from sers_private.public_evidence e
  where e.created_at < now() - interval '1 hour'
    and not exists (
      select 1 from sers_private.public_reporters r where r.photo_path = e.path
    );
  delete from sers_private.public_upload_tickets where expires_at <= now();
  if p_content_type is null or p_content_type not in ('image/jpeg','image/png','image/webp')
    or p_size is null or p_size not between 1 and 3145728 then
    raise exception 'Choose a supported image under 3 MB.';
  end if;
  extension := case p_content_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    else 'webp'
  end;
  ticket_id := gen_random_uuid();
  object_path := 'uploads/' || ticket_id::text || '/' || gen_random_uuid()::text || '.' || extension;
  insert into sers_private.public_upload_tickets(id, content_type, byte_size)
    values(ticket_id, p_content_type, p_size);
  return jsonb_build_object('ticket', ticket_id, 'path', object_path);
end;
$$;

create or replace function sers_private.store_public_evidence(
  p_path text,
  p_content_type text,
  p_data_base64 text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ticket_id uuid;
  expected_type text;
  expected_size integer;
  image_bytes bytea;
begin
  if p_path is null or p_path !~ '^uploads/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then
    raise exception 'The photograph could not be verified. Please choose it again.';
  end if;
  if p_data_base64 is null or length(p_data_base64) not between 4 and 6990508
    or length(p_data_base64) % 4 <> 0
    or p_data_base64 !~ '^[A-Za-z0-9+/]*={0,2}$' then
    raise exception 'The photograph could not be uploaded. Choose it again or continue without a photograph.';
  end if;

  ticket_id := split_part(p_path, '/', 2)::uuid;
  select t.content_type, t.byte_size into expected_type, expected_size
  from sers_private.public_upload_tickets t
  where t.id = ticket_id and t.expires_at > now();
  if expected_type is null or expected_type is distinct from p_content_type then
    raise exception 'The photograph upload expired. Please retry the submission.';
  end if;

  image_bytes := decode(p_data_base64, 'base64');
  if octet_length(image_bytes) <> expected_size then
    raise exception 'The photograph could not be verified. Please choose it again.';
  end if;

  insert into sers_private.public_evidence(path, ticket_id, content_type, byte_size, image_data)
  values (p_path, ticket_id, expected_type, expected_size, image_bytes);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function sers_private.submit_public_report(
  p_category text,
  p_description text,
  p_reporter_name text,
  p_contact_phone text,
  p_latitude double precision,
  p_longitude double precision,
  p_access_token text,
  p_photo_path text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  incident public.sers_incidents;
  existing public.sers_incidents;
  token_hash text;
  report_reference text;
  existing_reference text;
  upload_id uuid;
  expected_type text;
  expected_size integer;
begin
  if p_category is null or p_category not in ('Road Accident','Fire Outbreak') then
    raise exception 'Choose Road Accident or Fire Outbreak.';
  end if;
  if length(trim(coalesce(p_reporter_name,''))) not between 2 and 60 then
    raise exception 'Enter a valid reporter name.';
  end if;
  if length(trim(coalesce(p_contact_phone,''))) not between 7 and 25
    or trim(p_contact_phone) !~ '^\+?[0-9][0-9 ()-]{5,23}$'
    or length(regexp_replace(p_contact_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Enter a valid telephone number.';
  end if;
  if length(trim(coalesce(p_description,''))) not between 10 and 2000 then
    raise exception 'Write a description between 10 and 2,000 characters.';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 then
    raise exception 'A confirmed location is required.';
  end if;
  if p_access_token is null or p_access_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'A valid private tracking code is required.';
  end if;

  token_hash := sers_private.public_access_hash(p_access_token);
  perform pg_advisory_xact_lock(hashtextextended('sers:public-report:' || token_hash, 0));

  -- Reusing the same private code makes a retry safe if the browser lost the
  -- response after the database committed. It never creates a duplicate.
  select i.* into existing
  from public.sers_incidents i
  join sers_private.public_reporters r on r.incident_id = i.id
  where r.access_token_hash = token_hash;
  if found then
    select r.reference into existing_reference
    from sers_private.public_reporters r where r.incident_id = existing.id;
    return jsonb_build_object(
      'reference', existing_reference,
      'category', existing.category,
      'status', existing.status,
      'submitted_at', existing.reported_at
    );
  end if;

  if p_photo_path is not null then
    if p_photo_path !~ '^uploads/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then
      raise exception 'The photograph could not be verified. Please choose it again.';
    end if;
    upload_id := split_part(p_photo_path, '/', 2)::uuid;
    select t.content_type, t.byte_size into expected_type, expected_size
    from sers_private.public_upload_tickets t
    where t.id = upload_id and t.expires_at > now();
    if expected_type is null or not exists (
      select 1 from sers_private.public_evidence e
      where e.path = p_photo_path
        and e.ticket_id = upload_id
        and e.content_type = expected_type
        and e.byte_size = expected_size
    ) then
      raise exception 'The photograph upload expired. Please retry the submission.';
    end if;
  end if;

  insert into public.sers_incidents(
    category, title, description, location, priority, latitude, longitude
  ) values (
    p_category,
    p_category || ' public report',
    trim(p_description),
    'GPS location captured',
    'High',
    p_latitude,
    p_longitude
  ) returning * into incident;

  report_reference := 'SERS-' || lpad(incident.number::text, 5, '0');
  insert into sers_private.public_reporters(
    incident_id, reference, reporter_name, contact_phone, access_token_hash, photo_path
  ) values (
    incident.id,
    report_reference,
    trim(p_reporter_name),
    trim(p_contact_phone),
    token_hash,
    p_photo_path
  );

  if upload_id is not null then
    delete from sers_private.public_upload_tickets where id = upload_id;
  end if;

  insert into sers_private.public_report_events(incident_id, sequence, title, at)
  values
    (incident.id, 1, 'Report submitted', incident.reported_at),
    (incident.id, 2, 'Report received', incident.reported_at);

  insert into public.sers_notifications(account_id, incident_id, title, at)
  select a.id, incident.id, 'New public ' || lower(p_category) || ' report', incident.reported_at
  from sers_private.accounts a
  where a.active and a.user_id is not null
    and (a.role = 'admin' or p_category = any(a.categories));

  return jsonb_build_object(
    'reference', report_reference,
    'category', incident.category,
    'status', incident.status,
    'submitted_at', incident.reported_at
  );
end;
$$;

create or replace function sers_private.track_public_report(
  p_reference text,
  p_access_token text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if p_reference is null or p_access_token is null then
    raise exception 'Report not found or tracking details are incorrect.';
  end if;
  select jsonb_build_object(
    'reference', r.reference,
    'category', i.category,
    'description', i.description,
    'status', i.status,
    'reported_at', i.reported_at,
    'updated_at', i.updated_at,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('title', e.title, 'at', e.at)
        order by e.at, e.sequence)
      from (
        select pe.title, pe.at, pe.sequence
        from sers_private.public_report_events pe
        where pe.incident_id = i.id
        union all
        select case
          when t.kind = 'assignment' then 'Responder assigned'
          when t.title = 'Status changed to responding' then 'Responder responding'
          when t.title = 'Status changed to resolved' then 'Incident resolved'
          when t.title = 'Status changed to cancelled' then 'Incident cancelled'
        end, t.at, 3
        from public.sers_timeline t
        where t.incident_id = i.id
          and (t.kind = 'assignment' or t.title in (
            'Status changed to responding',
            'Status changed to resolved',
            'Status changed to cancelled'
          ))
      ) e
    ), '[]'::jsonb)
  ) into result
  from sers_private.public_reporters r
  join public.sers_incidents i on i.id = r.incident_id
  where r.reference = upper(trim(p_reference))
    and r.access_token_hash = sers_private.public_access_hash(p_access_token);
  if result is null then
    raise exception 'Report not found or tracking details are incorrect.';
  end if;
  return result;
end;
$$;

create or replace function sers_private.reporter_details(p_incident_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  incident public.sers_incidents;
  result jsonb;
begin
  if sers_private.current_account() is null then
    raise exception 'Sign in to view reporter details.' using errcode = '42501';
  end if;
  select * into incident from public.sers_incidents where id = p_incident_id;
  if incident.id is null or not (
    sers_private.is_admin() or incident.category = any(sers_private.current_categories())
  ) then
    raise exception 'You cannot view this reporter.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'name', r.reporter_name,
    'phone', r.contact_phone,
    'photo_path', r.photo_path
  ) into result
  from sers_private.public_reporters r where r.incident_id = p_incident_id;
  return result;
end;
$$;

create or replace function public.sers_create_public_upload_ticket(
  p_content_type text,
  p_size integer
) returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.create_public_upload_ticket(p_content_type, p_size)
$$;

create or replace function public.sers_store_public_evidence(
  p_path text,
  p_content_type text,
  p_data_base64 text
) returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.store_public_evidence(p_path, p_content_type, p_data_base64)
$$;

create or replace function public.sers_submit_public_report(
  p_category text,
  p_description text,
  p_reporter_name text,
  p_contact_phone text,
  p_latitude double precision,
  p_longitude double precision,
  p_access_token text,
  p_photo_path text default null
) returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.submit_public_report(
    p_category, p_description, p_reporter_name, p_contact_phone,
    p_latitude, p_longitude, p_access_token, p_photo_path
  )
$$;

create or replace function public.sers_track_public_report(
  p_reference text,
  p_access_token text
) returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.track_public_report(p_reference, p_access_token)
$$;

create or replace function public.sers_public_reporter_details(p_incident_id uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.reporter_details(p_incident_id)
$$;

create or replace function sers_private.reporter_photo(p_incident_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  incident public.sers_incidents;
  result jsonb;
begin
  if sers_private.current_account() is null then
    raise exception 'Sign in to view reporter details.' using errcode = '42501';
  end if;
  select * into incident from public.sers_incidents where id = p_incident_id;
  if incident.id is null or not (
    sers_private.is_admin() or incident.category = any(sers_private.current_categories())
  ) then
    raise exception 'You cannot view this reporter.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'content_type', e.content_type,
    'data_base64', replace(encode(e.image_data, 'base64'), E'\n', '')
  ) into result
  from sers_private.public_reporters r
  join sers_private.public_evidence e on e.path = r.photo_path
  where r.incident_id = p_incident_id;
  return result;
end;
$$;

create or replace function public.sers_public_reporter_photo(p_incident_id uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select sers_private.reporter_photo(p_incident_id)
$$;

revoke all on function sers_private.public_access_hash(text),
  sers_private.create_public_upload_ticket(text, integer),
  sers_private.store_public_evidence(text, text, text),
  sers_private.submit_public_report(text, text, text, text, double precision, double precision, text, text),
  sers_private.track_public_report(text, text),
  sers_private.reporter_details(uuid),
  sers_private.reporter_photo(uuid)
from public, anon, authenticated;

revoke all on function public.sers_create_public_upload_ticket(text, integer),
  public.sers_store_public_evidence(text, text, text),
  public.sers_submit_public_report(text, text, text, text, double precision, double precision, text, text),
  public.sers_track_public_report(text, text),
  public.sers_public_reporter_details(uuid),
  public.sers_public_reporter_photo(uuid)
from public, anon, authenticated;

grant execute on function public.sers_create_public_upload_ticket(text, integer),
  public.sers_store_public_evidence(text, text, text),
  public.sers_submit_public_report(text, text, text, text, double precision, double precision, text, text),
  public.sers_track_public_report(text, text)
to anon;
grant execute on function public.sers_public_reporter_details(uuid) to authenticated;
grant execute on function public.sers_public_reporter_photo(uuid) to authenticated;

comment on table sers_private.public_reporters is
  'Private reporter contact and capability-token hash for unauthenticated public emergency reports.';
comment on table sers_private.public_evidence is
  'Private, ticket-validated image bytes attached to public emergency reports.';
comment on function public.sers_submit_public_report(text, text, text, text, double precision, double precision, text, text) is
  'Validates and creates a public report in the shared dashboard incident table without granting anonymous table access.';
