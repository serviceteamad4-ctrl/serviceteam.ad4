-- รูปที่รอเลือกมาได้ทั้งจาก "แจ้งเปิดงาน" (ใส่ในช่อง image) และ "แจ้งปิดงาน" (ใส่ในช่อง completedImage)
ALTER TABLE line_pending_images ADD COLUMN IF NOT EXISTS field text NOT NULL DEFAULT 'image';
