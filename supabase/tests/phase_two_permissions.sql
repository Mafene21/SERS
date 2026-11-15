-- Run as the database owner against a migrated project. All fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000001','sers-permission-admin@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000002','sers-permission-road@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000003','sers-permission-fire@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000004','sers-permission-outsider@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000005','sers-permission-both@example.invalid',now());
insert into auth.sessions(id,user_id) values
 ('00000000-0000-4000-9000-000000000001','00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-9000-000000000002','00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-9000-000000000003','00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-9000-000000000004','00000000-0000-4000-8000-000000000004'),
 ('00000000-0000-4000-9000-000000000005','00000000-0000-4000-8000-000000000005');
insert into sers_private.accounts(id,email,name,role,category,user_id) values
 ('00000000-0000-4000-a000-000000000001','sers-permission-admin@example.invalid','Test admin','admin',null,'00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-a000-000000000002','sers-permission-road@example.invalid','Test road','responder','Road Accident','00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-a000-000000000003','sers-permission-fire@example.invalid','Test fire','responder','Fire Outbreak','00000000-0000-4000-8000-000000000003');
insert into public.sers_responders(id,name,callsign,category,availability,enrolled) values
 ('00000000-0000-4000-a000-000000000002','Test road','TEST-ROAD','Road Accident','Available',true),
 ('00000000-0000-4000-a000-000000000003','Test fire','TEST-FIRE','Fire Outbreak','Available',true);
insert into sers_private.accounts(id,email,name,role,category,categories,user_id) values
 ('00000000-0000-4000-a000-000000000005','sers-permission-both@example.invalid','Test both','responder','Road Accident',array['Road Accident','Fire Outbreak'],'00000000-0000-4000-8000-000000000005');
insert into public.sers_responders(id,name,callsign,category,categories,availability,enrolled) values
 ('00000000-0000-4000-a000-000000000005','Test both','TEST-BOTH','Road Accident',array['Road Accident','Fire Outbreak'],'Available',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000001"}',true);
select public.sers_mutate('approve_account','{"email":"sers-permission-new-both@example.invalid","name":"New dual responder","role":"responder","category":"Road Accident","categories":["Road Accident","Fire Outbreak"],"callsign":"BOTH-NEW"}');
do $$ begin
  if not exists(select 1 from public.sers_responders where callsign='BOTH-NEW' and categories=array['Road Accident','Fire Outbreak']) then raise exception 'TEST FAILED: dual-team approval'; end if;
  begin
    perform public.sers_mutate('approve_account','{"email":"sers-permission-invalid@example.invalid","name":"Invalid teams","role":"responder","category":"Road Accident","categories":["Road Accident","Road Accident"],"callsign":"INVALID"}');
    raise exception 'TEST FAILED: duplicate teams accepted';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
select public.sers_mutate('report','{"id":"00000000-0000-4000-b000-000000000001","title":"Permission test road incident","description":"Disposable transaction-only test report.","location":"Test location","category":"Road Accident","priority":"High","latitude":0.32,"longitude":32.58}');
select public.sers_mutate('report','{"id":"00000000-0000-4000-b000-000000000002","title":"Permission test fire incident","description":"Disposable transaction-only test report.","location":"Test location","category":"Fire Outbreak","priority":"High"}');
select public.sers_mutate('report','{"id":"00000000-0000-4000-b000-000000000003","title":"Second road incident for assignment test","description":"Disposable transaction-only test report.","location":"Test location","category":"Road Accident","priority":"Low"}');
select public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000001","responderId":"00000000-0000-4000-a000-000000000002"}');
do $$ begin
  begin
    perform public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000002","responderId":"00000000-0000-4000-a000-000000000002"}');
    raise exception 'TEST FAILED: cross-team assignment succeeded';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
  begin
    perform public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000003","responderId":"00000000-0000-4000-a000-000000000002"}');
    raise exception 'TEST FAILED: double assignment succeeded';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
  begin
    perform public.sers_mutate('active','{"id":"00000000-0000-4000-a000-000000000002","active":false}');
    raise exception 'TEST FAILED: busy responder deactivated';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
-- A dual-team responder can handle either category, with one active assignment total.
select public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000002","responderId":"00000000-0000-4000-a000-000000000005"}');
do $$ begin
  begin
    perform public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000003","responderId":"00000000-0000-4000-a000-000000000005"}');
    raise exception 'TEST FAILED: cross-team double assignment';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000005"}',true);
do $$ begin
  if (select count(*) from public.sers_incidents) <> 3 then raise exception 'TEST FAILED: dual-team visibility'; end if;
  if jsonb_array_length(public.sers_claim_account()->'categories') <> 2 then raise exception 'TEST FAILED: dual-team account response'; end if;
  if not exists(select 1 from public.sers_notifications where incident_id='00000000-0000-4000-b000-000000000002') then raise exception 'TEST FAILED: dual-team fire notifications'; end if;
  begin
    perform public.sers_mutate('note','{"id":"00000000-0000-4000-b000-000000000003","note":"Not my assignment"}');
    raise exception 'TEST FAILED: dual-team updated unassigned incident';
  exception when insufficient_privilege then null; end;
end $$;
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000002","status":"Accepted"}');
select public.sers_mutate('note','{"id":"00000000-0000-4000-b000-000000000002","note":"Dual responder fire response"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000002","status":"Responding"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000002","status":"Resolved"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000001"}',true);
select public.sers_mutate('assign','{"id":"00000000-0000-4000-b000-000000000003","responderId":"00000000-0000-4000-a000-000000000005"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000005"}',true);
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000003","status":"Accepted"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000003","status":"Responding"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000003","status":"Resolved"}');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000002","user_metadata":{"role":"admin"}}',true);
do $$ begin
  if exists(select 1 from public.sers_incidents where category='Fire Outbreak') then raise exception 'TEST FAILED: cross-team read'; end if;
  if exists(select 1 from public.sers_responders where category='Fire Outbreak') then raise exception 'TEST FAILED: cross-team directory'; end if;
  if has_table_privilege('authenticated','public.sers_incidents','UPDATE') then raise exception 'TEST FAILED: direct writes allowed'; end if;
  if jsonb_array_length(public.sers_accounts()) <> 0 then raise exception 'TEST FAILED: staff email list exposed'; end if;
  begin
    perform public.sers_mutate('approve_account','{"email":"attack@example.invalid","name":"Attack admin","role":"admin","callsign":""}');
    raise exception 'TEST FAILED: self promotion';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sers_mutate('note','{"id":"00000000-0000-4000-b000-000000000003","note":"Unauthorized note"}');
    raise exception 'TEST FAILED: other responder incident updated';
  exception when insufficient_privilege then null; end;
  begin
    perform public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000001","status":"Resolved"}');
    raise exception 'TEST FAILED: skipped workflow states';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
  begin
    perform public.sers_mutate('availability','{"id":"00000000-0000-4000-a000-000000000002","availability":"Off duty"}');
    raise exception 'TEST FAILED: active assignment abandoned';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000001","status":"Accepted"}');
select public.sers_mutate('note','{"id":"00000000-0000-4000-b000-000000000001","note":"Verified test response note"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000001","status":"Responding"}');
select public.sers_mutate('transition','{"id":"00000000-0000-4000-b000-000000000001","status":"Resolved"}');
do $$ begin
  if (select availability from public.sers_responders where id='00000000-0000-4000-a000-000000000002') <> 'Available' then raise exception 'TEST FAILED: responder not released'; end if;
  begin
    perform public.sers_mutate('note','{"id":"00000000-0000-4000-b000-000000000001","note":"Change closed history"}');
    raise exception 'TEST FAILED: closed history changed';
  exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end $$;
reset role;
update sers_private.accounts set active=false where id='00000000-0000-4000-a000-000000000002';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.sers_incidents) then raise exception 'TEST FAILED: inactive account read'; end if;
  begin
    perform public.sers_mutate('preferences','{"dark":true}');
    raise exception 'TEST FAILED: inactive account write';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","session_id":"00000000-0000-4000-9000-000000000004"}',true);
do $$ begin
  if exists(select 1 from public.sers_incidents) then raise exception 'TEST FAILED: unapproved account read'; end if;
  begin
    perform public.sers_claim_account();
    raise exception 'TEST FAILED: unapproved account claimed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: team isolation, own assignments, workflow, account restrictions, immutable history, capacity, dual-team access and deactivation' as result;
