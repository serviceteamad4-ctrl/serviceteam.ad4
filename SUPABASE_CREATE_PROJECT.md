# วิธีสร้างและตั้งค่า Project ใน Supabase แบบละเอียด

## ขั้นตอนที่ 1: สมัครสมาชิก Supabase

### 1.1 เข้าเว็บไซต์
- ไปที่ **https://supabase.com**
- คลิก **"Sign Up"** (มุมบนขวา)

### 1.2 เลือกวิธีสมัครสมาชิก
สามารถเลือกหนึ่งในนี้:
- **GitHub** (ง่ายที่สุด - ใช้บัญชี GitHub)
- **Google** (ใช้บัญชี Google)
- **Email** (สมัครด้วยอีเมล)

**แนะนำ:** ใช้ GitHub เพราะเชื่อมต่อกับ Git ได้สะดวก

### 1.3 ยืนยันอีเมล
- ไปตรวจสอบอีเมลของคุณ
- คลิกลิงก์ยืนยันจากอีเมลของ Supabase

---

## ขั้นตอนที่ 2: สร้าง Project ใหม่

### 2.1 จากหน้าแรก
1. หลังจาก Sign In สำเร็จ คุณจะมาที่หน้า **Projects**
2. ค้นหาปุ่ม **"New project"** (ปุ่มสีเขียว)
3. คลิกปุ่มนี้

### 2.2 กรอกข้อมูล Project

```
┌─────────────────────────────────────┐
│  Create New Project                 │
├─────────────────────────────────────┤
│                                     │
│ Organization: [เลือก]                │
│                                     │
│ Project Name: *                     │
│ ┌─────────────────────────────────┐ │
│ │ service-desk                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Database Password: * (ต้องจำไว้!)    │
│ ┌─────────────────────────────────┐ │
│ │ ••••••••••••••••• (ซ่อน)         │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Region: * (เลือกพื้นที่)              │
│ ┌─────────────────────────────────┐ │
│ │ Southeast Asia (Singapore)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│          [ Create project ]          │
└─────────────────────────────────────┘
```

### 2.3 รายละเอียดแต่ละช่อง

#### **Project Name** (ชื่อ Project)
```
ตัวอย่างที่ดี:
- service-desk
- service-desk-app
- servicedesk-v2

⚠️ ห้าม:
- ใช้ช่องว่าง
- ใช้อักษรพิเศษ (*,@,#)
- ชื่อซ้ำกับ Project อื่น
```

#### **Database Password** (รหัสผ่านฐานข้อมูล)
```
⚠️ สำคัญมาก! ต้องจำไว้
- ใช้อักษรตัวพิมพ์เล็กและใหญ่
- ใช้ตัวเลข
- ใช้อักษรพิเศษ เช่น !@#$%

ตัวอย่างที่แข็งแกร่ง:
MyServiceDesk@2024!

อย่าใช้:
❌ 123456
❌ password
❌ supabase
```

**💾 บันทึกรหัสผ่าน!**
```
ใช้ที่ใดสำหรับ DATABASE_URL:
postgresql://postgres:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
                    ^^^^^^^^^^^^^^^^
```

#### **Region** (พื้นที่เซิร์ฟเวอร์)
```
ตัวเลือกทั่วไป:
🌏 Southeast Asia (Singapore) - ถ้าอยู่เอเชียตะวันออกเฉียงใต้
🌍 Asia-Pacific (Tokyo) - ถ้าอยู่ญี่ปุ่น/เกาหลี
🌎 US East (N. Virginia) - ถ้าอยู่สหรัฐ

⏱️ ปกติใช้ Singapore ส่วนใหญ่สำหรับผู้ใช้ไทย
```

### 2.4 คลิก "Create project"
- รอให้ Supabase สร้าง Project (ใช้เวลา 2-3 นาที)
- จะเห็นหน้า loading ด้วยแถบ Progress

---

## ขั้นตอนที่ 3: รอ Project สร้างเสร็จ

```
✓ Creating project...        [████████░░░░] 60%
✓ Setting up database...      [██████████░░] 75%
✓ Preparing storage...        [██████████░░] 85%
✓ Initializing...             [████████████] 100%

✅ Project created successfully!
```

---

## ขั้นตอนที่ 4: เข้าดู Project Dashboard

### 4.1 หน้า Welcome
หลังจาก Project สร้างเสร็จ คุณจะเห็น:

```
┌─────────────────────────────────────────┐
│ Welcome to your new Supabase project!   │
│                                         │
│ Your Database is ready                  │
│ Your Storage is ready                   │
│                                         │
│ Quick start:                            │
│ ▶️ Connect to your database             │
│ ▶️ Create tables                        │
│ ▶️ Upload files                         │
└─────────────────────────────────────────┘
```

### 4.2 Menu ด้านซ้าย
```
📌 Home
📊 SQL Editor
📋 Database
🗂️  Storage
🔐 Auth
⚙️  Project Settings
📈 Realtime
🔔 Webhooks
```

---

## ขั้นตอนที่ 5: ดึงข้อมูล API Keys และ Connection String

### 5.1 ไปที่ Project Settings
```
คลิก: ⚙️ Project Settings (เมนูล่าง)
```

### 5.2 ไปที่หน้า "API"
```
ด้านซ้าย: Project Settings
           └─ API

หรือ: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/api
```

### 5.3 คัดลอกข้อมูลต่อไปนี้

#### **1. Project URL** (URL ของ Project)
```
https://xohimzcrnyqhigrxnyor.supabase.co/rest/v1/
```

#### **2. Anon Public Key** (สำหรับ Frontend)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaGltemNybnlxaGlncnhueW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MzczMDgsImV4cCI6MjEwNDUxMzMwOH0.rWAQjx4DIgrk2sL9J6sz-AdtfdxTKfoswe_DfOl2NZE
```

#### **3. Service Role Secret** (สำหรับ Backend)
```

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaGltemNybnlxaGlncnhueW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODkzNzMwOCwiZXhwIjoyMTA0NTEzMzA4fQ.wp4VyXKW5r3ZkvYtWKeQpF0j7w0byBmNnCjYW3Hlioo
```

---

## ขั้นตอนที่ 6: ไปที่หน้า Database

### 6.1 คลิก "Database" ในเมนูซ้าย
```
หรือ: https://app.supabase.com/project/YOUR_PROJECT_ID/editor
```

### 6.2 ไปที่ "Connection pooling"
```
Project Settings
    └─ Database
       └─ Connection pooling
```

### 6.3 คัดลอก Connection String
```
ชนิด: Transaction mode (ใช้สำหรับ Apps)

ตัวอย่าง:
postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

⚠️ แทน YOUR_PASSWORD ด้วยรหัสผ่านที่คุณสร้างในขั้นตอนที่ 2
```

---

## ขั้นตอนที่ 7: สร้าง Database Table

### 7.1 ไปที่ SQL Editor
```
คลิก: 📊 SQL Editor (เมนูซ้าย)

หรือ: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/1
```

### 7.2 คลิก "New Query"
```
ปุ่มสีฟ้าที่มุมบนซ้าย
```

### 7.3 วางโค้ด SQL
```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer TEXT NOT NULL,
  ref TEXT,
  source TEXT,
  "receivedAt" TIMESTAMP,
  ticket TEXT,
  location TEXT,
  site TEXT,
  contact TEXT,
  phone TEXT,
  description TEXT,
  image TEXT,
  ma TEXT DEFAULT 'N',
  "jobType" TEXT,
  status TEXT,
  assignee TEXT,
  appointment TIMESTAMP,
  "appointmentEnd" TIMESTAMP,
  action TEXT,
  result TEXT,
  equipment TEXT,
  "completedImage" TEXT,
  "completedAt" TIMESTAMP,
  map TEXT,
  vehicle TEXT,
  notes TEXT,
  file TEXT,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP DEFAULT now()
);
```

### 7.4 คลิก "Run" (ปุ่มสีน้ำเงิน)
```
หรือ กด Ctrl+Enter

ถ้าสำเร็จจะเห็น: "Query executed successfully"
```

---

## ขั้นตอนที่ 8: สร้าง Storage Bucket

### 8.1 ไปที่ Storage
```
คลิก: 🗂️  Storage (เมนูซ้าย)

หรือ: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets
```

### 8.2 คลิก "Create a new bucket"
```
ปุ่มสีฟ้า
```

### 8.3 กรอกข้อมูล
```
Name:          service-desk-images
Visibility:    Public (ไม่ใช่ Private)
```

### 8.4 คลิก "Create bucket"
```
ปุ่มสีฟ้า

ถ้าสำเร็จจะเห็น bucket ในรายการ
```

---

## ขั้นตอนที่ 9: สรุปข้อมูลที่ต้องเก็บ

```
✅ Project URL:
   https://abcdefghijk123456.supabase.co

✅ Anon Key:
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✅ Service Role Key:
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

✅ Database Password:
   MyServiceDesk@2024!

✅ Connection String:
   postgresql://postgres.YOUR_PROJECT_ID:MyServiceDesk@2024!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

✅ Storage Bucket:
   service-desk-images (Created)

✅ Database Table:
   requests (Created)
```

---

## ขั้นตอนที่ 10: ตั้งค่า Environment Variables

### 10.1 สร้างไฟล์ `.env` ในโครงการ
```bash
# ที่ D:\report 2.0\.env
VITE_API_URL=http://localhost:4001
VITE_SUPABASE_URL=https://abcdefghijk123456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 10.2 สร้างไฟล์ `.env` ในโฟลเดอร์ server
```bash
# ที่ D:\report 2.0\server\.env
PORT=4001
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:MyServiceDesk@2024!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://abcdefghijk123456.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL=http://localhost:5173
```

---

## ✅ เสร็จแล้ว!

ตอนนี้คุณได้:
- ✅ สร้าง Supabase Project
- ✅ ได้ API Keys ทั้งหมด
- ✅ สร้าง Database Table
- ✅ สร้าง Storage Bucket
- ✅ ตั้งค่า Environment Variables

### ขั้นต่อไป:
```bash
# ติดตั้ง dependencies
npm install
cd server && npm install

# เปิด backend
cd server && npm run dev

# เปิด frontend (terminal ใหม่)
npm run dev
```

---

## 🆘 ปัญหาทั่วไป

### ❌ "ลืม Database Password"
- ไปที่ Project Settings → Database → Reset password
- สร้างรหัสผ่านใหม่

### ❌ "Project URL ไหนครับ"
- Project Settings → API → Project URL

### ❌ "ไม่เห็นปุ่ม Create Bucket"
- ตรวจสอบว่าอยู่ในเมนู Storage แล้ว
- โปรเจกต์ต้องสร้างเสร็จแล้ว

### ❌ "SQL Error เมื่อสร้างตาราง"
- คัดลอก SQL ทั้งหมด
- ลบข้อมูลเก่า (ถ้ามี)
- รัน SQL ใหม่

---

## 📱 ยูทิวบ์ช่วย (ตัวเลือก)
ถ้ายังสับสน สามารถ Search ยูทิวบ์:
- "Supabase Project Setup"
- "Supabase PostgreSQL Tutorial"
- "Supabase Storage Upload"

เรียบร้อย! 🎉
