begin;
set local role service_role;
select public.sers_guest_submit('{"id":"00000000-0000-4000-a000-000000009901","category":"Fire Outbreak","title":"Disposable guest test","description":"Transaction-only verification, not a real emergency.","location":"Fictional test location","latitude":0.32,"longitude":32.58,"phone":"","name":"Guest test"}',repeat('a',64),repeat('b',64),repeat('c',64));
select public.sers_guest_submit('{"id":"00000000-0000-4000-a000-000000009901","category":"Fire Outbreak","title":"Disposable guest test","description":"Transaction-only verification, not a real emergency.","location":"Fictional test location","latitude":0.32,"longitude":32.58}',repeat('a',64),repeat('b',64),repeat('c',64));
do $$ begin
 if public.sers_guest_status('00000000-0000-4000-a000-000000009901',repeat('a',64))->>'status' <> 'Pending' then raise exception 'TEST FAILED: report tracking'; end if;
 begin
  perform public.sers_guest_status('00000000-0000-4000-a000-000000009901',repeat('d',64));
  raise exception 'TEST FAILED: incorrect tracking secret accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.sers_guest_submit('{"id":"00000000-0000-4000-a000-000000009902","category":"Fire Outbreak","title":"No chosen location","description":"Missing coordinates must be rejected.","location":"Fictional test location"}',repeat('a',64),repeat('b',64),repeat('c',64));
  raise exception 'TEST FAILED: missing coordinates accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.sers_incidents where id='00000000-0000-4000-a000-000000009901') <> 1 then raise exception 'TEST FAILED: duplicate report created'; end if;
 if has_function_privilege('anon','public.sers_guest_status(uuid,text)','execute') or has_function_privilege('authenticated','public.sers_guest_submit(jsonb,text,text,text)','execute') then raise exception 'TEST FAILED: direct guest RPC bypass'; end if;
 if has_table_privilege('anon','public.sers_citizen_contacts','select') then raise exception 'TEST FAILED: contact details publicly readable'; end if;
 if (select public from storage.buckets where id='sers-citizen-photos') then raise exception 'TEST FAILED: photos are public'; end if;
end $$;
-- Internal response notes are never part of a citizen's tracking response.
insert into public.sers_timeline(incident_id,actor_id,actor,title,detail,kind) values('00000000-0000-4000-a000-000000009901',null,'Test','Private staff note','Must not be returned to citizens.','note');
set local role service_role;
do $$ begin
 if jsonb_array_length(public.sers_guest_status('00000000-0000-4000-a000-000000009901',repeat('a',64))->'timeline')<>1 then raise exception 'TEST FAILED: internal notes leaked'; end if;
end $$;
reset role;
rollback;
select 'PASS: guest capability protection, idempotency, location validation, private contacts/photos, hidden internal notes' as result;
