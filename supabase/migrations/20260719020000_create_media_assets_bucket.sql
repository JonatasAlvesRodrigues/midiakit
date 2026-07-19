insert into storage.buckets (id, name, public)
values ('media-assets', 'media-assets', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public can view media assets" on storage.objects;
create policy "Public can view media assets"
on storage.objects
for select
to public
using (bucket_id = 'media-assets');

drop policy if exists "Authenticated users can upload own media assets" on storage.objects;
create policy "Authenticated users can upload own media assets"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'media-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Authenticated users can update own media assets" on storage.objects;
create policy "Authenticated users can update own media assets"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'media-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
    bucket_id = 'media-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Authenticated users can delete own media assets" on storage.objects;
create policy "Authenticated users can delete own media assets"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'media-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);
