-- ซัพพลายเออร์ที่รับงานต่อ ใช้กับหน้า "ติดตามงานซัพ"
ALTER TABLE requests ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "supplierNotifiedAt" timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "supplierIssue" text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "supplierStatus" text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "supplierFollowUpAt" timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS "supplierNote" text;
