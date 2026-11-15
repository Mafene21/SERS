-- Photos remain private and follow the same team/session permissions as incidents.
create policy sers_staff_scene_photos on storage.objects for select to authenticated
using (bucket_id = 'sers-citizen-photos' and exists (
  select 1 from public.sers_citizen_contacts c where c.photo_path = storage.objects.name
));
