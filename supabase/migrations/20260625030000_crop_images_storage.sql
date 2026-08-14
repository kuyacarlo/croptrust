-- Crop & parcel image storage bucket
-- Stores listing photos, crop images, and farmer uploads

-- 1) Public bucket for crop images (anyone can view)
insert into storage.buckets (id, name, public)
values ('crop-images', 'crop-images', true)
on conflict (id) do nothing;

-- Allow public reads (images are embedded in marketplace / explore)
drop policy if exists "crop_images_select" on storage.objects;
create policy "crop_images_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'crop-images');

-- Authenticated users can upload
drop policy if exists "crop_images_insert" on storage.objects;
create policy "crop_images_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'crop-images');
