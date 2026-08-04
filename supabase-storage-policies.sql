-- ============================================
-- MEMBBA — Avatar Storage Policies
-- Run in Supabase SQL Editor if profile photo upload says permission denied.
-- The avatars bucket was created by the setup script, but uploads need policies.
-- ============================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'avatars');

create policy "Authenticated users can update avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'avatars')
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'avatars');

create policy "Anyone can read public avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
