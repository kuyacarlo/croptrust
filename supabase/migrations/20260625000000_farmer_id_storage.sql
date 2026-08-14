-- Farmer ID verification document storage (replaces Google Cloud Storage)
-- Creates a private bucket and the RLS policies needed for uploads/reads.

-- 1) Private bucket for farmer ID documents.
insert into storage.buckets (id, name, public)
values ('farmer-ids', 'farmer-ids', false)
on conflict (id) do nothing;

-- 2) Allow uploads to the farmer-ids bucket.
--    NOTE: granting to `anon` means anyone holding the publishable key can
--    upload to this bucket. For stricter control, generate signed upload URLs
--    server-side with a service-role key and drop the `anon` grant here.
drop policy if exists "farmer_ids_insert" on storage.objects;
create policy "farmer_ids_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'farmer-ids');

-- 3) Allow reading objects from the bucket (used to generate signed/download URLs).
drop policy if exists "farmer_ids_select" on storage.objects;
create policy "farmer_ids_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'farmer-ids');
