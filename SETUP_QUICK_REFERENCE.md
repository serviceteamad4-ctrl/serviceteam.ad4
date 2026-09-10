# ตั้งค่า Supabase - ด่วน (5 นาที)

## 1️⃣ สร้าง Supabase Account
```
1. ไปที่ https://supabase.com
2. Click "Sign Up" > เลือก GitHub / Google
3. ยืนยันอีเมล
```

## 2️⃣ สร้าง Project
```
1. Click "New project"
2. กรอก:
   - Project Name: service-desk
   - Password: MyPassword123!
   - Region: Southeast Asia (Singapore)
3. Click "Create project" (รอ 2-3 นาที)
```

## 3️⃣ ดึง API Keys
```
Project Settings > API

คัดลอก 3 อย่างนี้:

📌 VITE_SUPABASE_URL = Project URL
   (เริ่มด้วย https://...supabase.co)

🔑 VITE_SUPABASE_ANON_KEY = anon public
   (อักษรยาว starts with eyJ...)

🔐 SUPABASE_SERVICE_ROLE_KEY = service_role secret
   (อักษรยาว starts with eyJ...)
```

## 4️⃣ ดึง Connection String
```
Project Settings > Database > Connection pooling

คัดลอก:
📊 DATABASE_URL = Transaction mode

ตัวอย่าง:
postgresql://postgres:PASSWORD@host:6543/postgres
```

## 5️⃣ สร้าง Table
```
SQL Editor > New Query

วาง SQL นี้:

CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer TEXT NOT NULL,
  ref TEXT, source TEXT, "receivedAt" TIMESTAMP, ticket TEXT,
  location TEXT, site TEXT, contact TEXT, phone TEXT,
  description TEXT, image TEXT, ma TEXT DEFAULT 'N',
  "jobType" TEXT, status TEXT, assignee TEXT,
  appointment TIMESTAMP, "appointmentEnd" TIMESTAMP,
  action TEXT, result TEXT, equipment TEXT,
  "completedImage" TEXT, "completedAt" TIMESTAMP,
  map TEXT, vehicle TEXT, notes TEXT, file TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);

Click "Run"
```

## 6️⃣ สร้าง Storage Bucket
```
Storage > Create a new bucket

Name: service-desk-images
Visibility: Public

Click "Create bucket"
```

## 7️⃣ ตั้ง .env Files

### `.env` (โฟลเดอร์หลัก)
```env
VITE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### `server/.env`
```env
PORT=4001
DATABASE_URL=postgresql://postgres:PASSWORD@host:6543/postgres
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
FRONTEND_URL=http://localhost:5173
```

## 8️⃣ เปิด Server
```bash
# Terminal 1: Backend
cd server
npm install
npm run dev

# Terminal 2: Frontend (โฟลเดอร์หลัก)
npm install
npm run dev
```

## ✅ เรียบร้อย!
- Frontend: http://localhost:5173
- Backend: http://localhost:4001

---

## 🚨 อย่าลืมสิ่งนี้!
- 🔑 เก็บ Service Role Key ให้เป็นความลับ
- 🔐 ห้ามใส่ .env ลงใน Git
- 📝 บันทึก Database Password
- 🌏 Region ควรเลือก Singapore (สำหรับไทย)
