-- "แจ้งปิดงาน" ที่ไม่ระบุเลขงาน แต่ลูกค้า+สถานที่ตรงกับงานค้างมากกว่า 1 งาน
-- ระบบไม่เดาเอง พักไว้ให้คนเลือกในหน้าเว็บว่าจะปิดงานไหน
CREATE TABLE IF NOT EXISTS line_pending_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_ids jsonb NOT NULL,          -- ["<requests.id>", ...] งานที่ตรงเงื่อนไขทั้งหมด
  fields jsonb NOT NULL,                 -- { customer, location, assignee, action } จากข้อความ
  completed_at timestamptz NOT NULL,     -- เวลาที่ส่งข้อความแจ้งปิดงาน (ใช้เป็นวันเวลาเสร็จ)
  images jsonb NOT NULL DEFAULT '[]',    -- รูปที่ส่งตามมา รอติดไปกับงานที่ถูกเลือก
  source_group_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
