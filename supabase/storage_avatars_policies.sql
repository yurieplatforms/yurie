-- Storage RLS policies for public `avatars` bucket

-- Clean up existing policies to avoid duplicates
drop policy if exists "Public read access to avatars" on storage.objects;
drop policy if exists "Authenticated users can upload to own avatars folder" on storage.objects;
drop policy if exists "Authenticated users can update own avatars" on storage.objects;
drop policy if exists "Authenticated users can delete own avatars" on storage.objects;

-- Public read access for files in the avatars bucket (useful even if bucket is public)
create policy "Public read access to avatars"
on storage.objects for select
using (
  bucket_id = 'avatars'
);

-- Allow authenticated users to upload files to their own userId/ folder
create policy "Authenticated users can upload to own avatars folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Allow authenticated users to update their own files in avatars bucket
create policy "Authenticated users can update own avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Allow authenticated users to delete their own files in avatars bucket
create policy "Authenticated users can delete own avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);


