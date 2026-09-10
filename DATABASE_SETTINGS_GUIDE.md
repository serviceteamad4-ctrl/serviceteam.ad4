# ทำความเข้าใจหน้า Database Settings

## 📍 คุณอยู่ที่ไหน
ลิงก์ของคุณชี้ไปที่:
```
Project Settings > Database > Settings
```

นี่คือหน้าสำคัญ! ที่นี่มี Connection String และข้อมูลสำคัญ

---

## 🎯 ต้องทำอะไร?

### ✅ ตัวเลือก 1: ดึง Connection String (ที่คุณต้อง)

```
ปัจจุบัน: คุณอยู่ที่ Database > Settings

ต้องเปลี่ยนไป: Database > Connection pooling

ขั้นตอน:
1. คลิก "Connection pooling" (แท็บด้านบน)
   (ดูแท็บ: [Settings] [Connection pooling] [Webhooks])
2. เลือก "Transaction mode"
3. คัดลอก Connection String
```

---

## 🔄 หรือถ้าต้องการ Reset Password

```
ในหน้า Database > Settings

ตรงหา:
├─ Database name: postgres
├─ Database user: postgres
└─ Database password: [Reset password] ← ปุ่มนี้

ถ้ากด Reset password:
⚠️ รหัสเก่าจะไม่ใช้ได้อีก
⚠️ ต้องอัพเดต DATABASE_URL
```

---

## 📋 ทั้ง Database Settings

ในหน้านี้ (Settings) คุณเห็น:

```
┌─────────────────────────────────────┐
│ Database Settings                   │
├─────────────────────────────────────┤
│                                     │
│ Database name:                      │
│ postgres                            │
│                                     │
│ Database user:                      │
│ postgres                            │
│                                     │
│ Database password: [🔓]             │
│ •••••••••••••••••                   │
│ [Reset password] ← ปุ่มสำคัญ!         │
│                                     │
│ Database version:                   │
│ PostgreSQL 15.1                     │
│                                     │
│ Max connections:                    │
│ 110                                 │
│                                     │
│ Disk size:                          │
│ 200 MB                              │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 สำหรับคุณ ต้องทำ:

### ขั้น 1: ไปที่ Connection pooling
```
1. คลิกแท็บ "Connection pooling" (เดียวกับ Settings)
2. จะเห็น Connection String
```

### ขั้น 2: เลือก Transaction Mode
```
ตรงบน: Connection pooler mode

ปุ่มเลือก:
○ Session mode
● Transaction mode  ← เลือกอันนี้
```

### ขั้น 3: คัดลอก
```
จะเห็น:
┌──────────────────────────────────┐
│ postgresql://postgres.xohimzcr... │
│              [Copy button]         │
└──────────────────────────────────┘

คัดลอกลงไป
```

### ขั้น 4: แทนรหัส
```
ที่คัดลอกมา:
postgresql://postgres.xohimzcr:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
                               ^^^^^^^^
                          (นี่คือ PASSWORD)

แทนด้วยรหัสจริง (ตัวอย่าง):
postgresql://postgres.xohimzcr:MyServiceDesk@2024!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
                               ^^^^^^^^^^^^^^^^^
```

### ขั้น 5: ใส่ใน .env
```
ไฟล์: server/.env

DATABASE_URL=postgresql://postgres.xohimzcr:MyServiceDesk@2024!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## 📌 สิ่งสำคัญในหน้านี้

| ข้อมูล | ตำแหน่ง | ใช้ที่ไหน |
|-------|--------|---------|
| Database user | Database > Settings | ชื่อ user: `postgres` |
| Database password | Database > Settings | ใช้ใน DATABASE_URL |
| Database version | Database > Settings | ตรวจสอบ: PostgreSQL 15+ |
| Connection string | Database > **Connection pooling** | ✅ ต้องการ DATABASE_URL |

---

## ⚠️ ถ้าลืมรหัสผ่าน

```
Database > Settings > Database password

คลิก [Reset password]
→ สร้างรหัสใหม่
→ เก็บไว้
→ อัพเดท DATABASE_URL
```

---

## ✅ เสร็จแล้ว!

```
✓ ได้ Connection String
✓ แทนรหัส
✓ ใส่ใน DATABASE_URL
✓ บันทึก .env

ตอนนี้พร้อม!
```

---

## 📍 ขั้นต่อไป

```
เมื่อได้ Connection String แล้ว:

1. ไปที่ SQL Editor
   Database > SQL Editor

2. คัดลอก SQL สร้าง Table
   (ดู SUPABASE_CREATE_PROJECT.md)

3. วาง SQL และ Run
   → Table 'requests' สร้างเสร็จ

4. ไปที่ Storage
   → สร้าง Bucket 'service-desk-images'

5. ตั้ง .env files ทั้งหมด

6. เปิด Server & Frontend
```

เรียบร้อยแล้ว! 🎉
