# หาตำแหน่ง Connection String ใน Supabase

## ❓ คุณกำลังหา Connection String ใช่ไหม?

จากรูปของคุณ คุณอยู่ที่หน้า **"Connection pooling"** ซึ่งถูกต้องแล้ว!

---

## ✅ ขั้นตอนหา Connection String

### 1️⃣ ไปที่ Project Settings
```
Supabase Dashboard > Project Settings (เมนูล่าง)
```

### 2️⃣ ไปที่ Database
```
Project Settings
    └─ Database (เมนูซ้าย)
```

### 3️⃣ ไปที่ Connection pooling
```
Database
    └─ Connection pooling (แท็บด้านบน)

👆 นี่คือที่คุณอยู่ในรูป
```

### 4️⃣ เลือก Mode: Transaction
```
ตรงบน: Connection pooler mode

เลือก: Transaction mode
```

### 5️⃣ ดูตัวอักษร Connection String
```
จะเห็นตัวอักษรสีน้ำเงิน ตรงนี้:

postgresql://postgres.YOUR_PROJECT_ID:
YOUR_PASSWORD@
aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

👆 คัดลอกทั้งหมด (ปุ่ม Copy ถัดจาก)
```

---

## 🎯 ตำแหน่งตรงในรูป

```
┌─ Connection pooling (คุณอยู่ตรงนี้) ✓
│
├─ Connection pool size = 15 connections
├─ Max client connections = 200 clients
│
└─ SSL configuration (ด้านล่าง)


⬇️ ต้องเลื่อนขึ้นหน่อย
   จะเห็น Connection String
```

---

## 📋 Connection String มี 2 ชนิด

### 🔵 Session Mode (ไม่ใช้)
```
postgresql://postgres.YOUR_PROJECT_ID:PASSWORD@
aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### 🟢 Transaction Mode (ใช้อันนี้!)
```
postgresql://postgres.YOUR_PROJECT_ID:PASSWORD@
aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
                                              ^^^^
                                          Port 6543
```

**👉 ใช้ Transaction Mode สำหรับแอป Express/Node.js**

---

## 🔍 หาได้ตรงไหน

```
┌────────────────────────────────────────┐
│ Connection pooling                      │
│────────────────────────────────────────│
│                                        │
│ Connection poolers                     │
│ Configuration is shared...             │
│                                        │
│ Connection pool size      [15]         │
│ Max client connections    [200]        │
│                                        │
│ ⬆️  ต้องเลื่อนขึ้นไป
│                                        │
│ จะเห็น:                                │
│                                        │
│ Connection string (Transaction):       │
│ ┌────────────────────────────────────┐ │
│ │ postgresql://postgres...@...com... │ │
│ │ [Copy]                             │ │
│ └────────────────────────────────────┘ │
│        👆 คัดลอกตัวอักษรนี้             │
│                                        │
└────────────────────────────────────────┘
```

---

## ⚠️ สำคัญ!

### 🔑 แทนค่าในตัวอักษร
```
ตัวอักษรที่ได้:
postgresql://postgres.abc123:PASSWORD@aws-0-ap-southeast-1...

ต้องแทน PASSWORD ด้วยรหัสที่คุณสร้างในขั้นตอนสร้าง Project
ตัวอย่าง: MyServiceDesk@2024!

ผลลัพธ์:
postgresql://postgres.abc123:MyServiceDesk@2024!@aws-0-ap-southeast-1...
```

### 📝 ใส่ใน .env
```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## ✅ ตรวจสอบ

ทั้งนี้ขึ้นอยู่กับ:
- ✓ อยู่ที่ Connection pooling
- ✓ เลือก **Transaction mode**
- ✓ คัดลอก Connection string
- ✓ แทน PASSWORD ด้วยของจริง
- ✓ ใส่ใน DATABASE_URL

---

## 🆘 ถ้ายังไม่เห็น

ลองเลื่อนหน้าขึ้นลง หรือ:
1. ออกจาก Database
2. เข้า Database ใหม่
3. ไปที่ Connection pooling
4. เลือก Transaction mode

เรียบร้อยแล้วครับ! 🎉
