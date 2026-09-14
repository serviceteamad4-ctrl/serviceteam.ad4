-- Storage → New bucket → ชื่อ service-desk-images (ตรงตัวนี้) → ติ๊ก Public bucket
-- SQL Editor → วางโค้ดข้างบนแล้วรัน

drop policy if exists "allow anon all on service-desk-images" on storage.objects;
create policy "allow anon all on service-desk-images" on storage.objects
  for all
  to anon
  using (bucket_id = 'service-desk-images')
  with check (bucket_id = 'service-desk-images');
