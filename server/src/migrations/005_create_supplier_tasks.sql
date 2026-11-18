-- งานติดตามซัพ: แยกจากงานแจ้งบริการ (requests) โดยสิ้นเชิง
CREATE TABLE IF NOT EXISTS supplier_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier text NOT NULL,
  topic text,
  location text,
  notified_at timestamptz,
  status text NOT NULL DEFAULT 'แจ้งแล้ว',
  follow_up_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
