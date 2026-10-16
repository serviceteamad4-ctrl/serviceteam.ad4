-- งานที่สร้างจากข้อความ LINE ที่มีรูปแนบมากกว่า 1 รูปในครั้งเดียว ระบบไม่เดาเองว่าจะใช้รูปไหน
-- จะสร้างงานไว้ก่อน (ไม่ใส่รูป) แล้วพักรูปที่ส่งมาทั้งหมดไว้ที่นี่ รอให้พนักงานเลือกในหน้าเว็บ
-- เก็บเป็นตาราง DB (ไม่ใช่แค่ในหน่วยความจำ) เพราะ Render free tier เคย sleep/restart ระหว่างรอได้
CREATE TABLE IF NOT EXISTS line_pending_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL REFERENCES requests(id) ON DELETE CASCADE, -- requests.id เป็นชนิด text ไม่ใช่ uuid
  ticket text,
  images jsonb NOT NULL, -- [{ "url": "https://...", "messageId": "..." }, ...] อัปโหลดขึ้น storage ไว้แล้วทุกรูป
  source_group_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS line_pending_images_request_id_idx ON line_pending_images (request_id);
