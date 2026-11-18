-- รูปของงานซัพ: รูปตอนแจ้ง / รูปหลังซัพแก้แล้ว
ALTER TABLE supplier_tasks ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE supplier_tasks ADD COLUMN IF NOT EXISTS fixed_image text;
