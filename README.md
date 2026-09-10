# Service Desk

ระบบจัดการงานบริการเวอร์ชันที่เป็นข้อมูลของคุณเอง พร้อมฐานข้อมูล Supabase PostgreSQL และเก็บไฟล์ภาพในคลาวด์

## ความสามารถ

- ✅ ตารางงานแจ้งบริการพร้อมค้นหาและกรองตามสถานะ/ระดับความเร่งด่วน
- ✅ เพิ่มและแก้ไขงาน พร้อมข้อมูลลูกค้า สถานที่ ผู้ติดต่อ นัดหมาย ผู้ดำเนินการ และผลการทำงาน
- ✅ **อัพโหลดรูปภาพ** ไปยัง Supabase Storage (แทนการเก็บเป็น base64)
- ✅ ฐานข้อมูล **PostgreSQL ผ่าน Supabase** (ระบบแบบ centralized)
- ✅ Dashboard รายงานจำนวนงานรายเดือน สถานะ ระดับความเร่งด่วน เวลาเฉลี่ยปิดงาน และอัตราปิดงาน
- ✅ ดาวน์โหลดข้อมูลทั้งหมดเป็น CSV

## เปิดใช้งาน

### ตั้งค่า Supabase (ทำครั้งแรกเท่านั้น)

ติดตามขั้นตอนใน **[QUICKSTART.md](QUICKSTART.md)** เพื่อตั้งค่า Supabase สำหรับครั้งแรก

### เริ่มใช้งาน Development

```bash
# ติดตั้ง dependencies
npm install
cd server && npm install && cd ..

# เปิด terminal 1: Backend
cd server && npm run dev

# เปิด terminal 2: Frontend
npm run dev
```

จากนั้นเปิด URL ที่ Vite แสดงใน terminal โดยปกติคือ `http://127.0.0.1:5173/`

## โครงสร้าง Project

### Frontend
- `src/App.jsx` - Component หลัก, state, CRUD, ตาราง และรายงาน
- `src/lib/supabase.js` - Supabase client สำหรับอัพโหลดรูปภาพ
- `src/main.jsx` - จุดเริ่มต้นของ React application
- `styles.css` - Visual system และ responsive layout

### Backend
- `server/src/server.js` - Express API server
- `server/src/supabase.js` - Supabase Storage integration
- `server/src/db.js` - Prisma database client
- `server/prisma/schema.prisma` - Database schema

## ไฟล์สำคัญ

- **[QUICKSTART.md](QUICKSTART.md)** - การตั้งค่าด่วน (5 นาที)
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - คำแนะนำการตั้งค่าโดยละเอียด
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - โยกย้ายข้อมูลเดิม (เฉพาะถ้ามีข้อมูลอยู่แล้ว)
- **[CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)** - รายละเอียดการเปลี่ยนแปลง

## การโยกย้ายข้อมูลเดิม

หากคุณมีข้อมูลเดิมกับรูปภาพแบบ base64 ติดตามขั้นตอนใน [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)

## สิ่งที่ต้องทำต่อไป (ทางเลือก)

- เพิ่มระบบล็อกอิน/สิทธิ์ผู้ใช้งาน (Supabase Auth พร้อมใช้)
- สำรองข้อมูลอัตโนมัติ
- การแจ้งเตือนและเมล
- การวิเคราะห์ข้อมูลขั้นสูง
