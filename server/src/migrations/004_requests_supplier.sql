-- ซัพพลายเออร์ที่รับงานต่อ ใช้กับหน้า "ติดตามงานซัพ"
ALTER TABLE requests ADD COLUMN IF NOT EXISTS supplier text;
