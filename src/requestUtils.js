// ต้องระบุ timeZone: 'Asia/Bangkok' เสมอ ไม่งั้นค่าจะถูกแปลงตาม timezone ของเครื่อง/เบราว์เซอร์ผู้ใช้
// ทำให้วันเวลาที่แสดงในหน้ารายละเอียดเคลื่อนไปจากที่กรอกไว้ (ไม่ตรงกับที่แสดงในหน้ารายการ)
export const formatDate = (value) => value ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '-';

// ข้อมูลที่นำเข้าจาก Excel ชุดเก่าบางส่วนเก็บแค่ชื่อไฟล์/พาธ (เช่น "DataServiceDR_Images/xxx.jpg")
// ไม่ใช่ URL รูปจริง (ไฟล์ต้นฉบับหาไม่พบแล้ว) จึงต้องแยกไว้ ไม่ให้ขึ้น <img> ที่โหลดไม่ได้
export const isViewableImageUrl = (value) => typeof value === 'string'
  && /^(https?:\/\/|data:image\/|\/)/i.test(value.trim());

// งานหนึ่งเก็บได้หลายรูป: ช่อง image / completedImage เก็บ URL หลายอันคั่นด้วยขึ้นบรรทัดใหม่
// (ข้อมูลเก่าที่มีรูปเดียวก็ยังอ่านได้เหมือนเดิม)
export const splitImages = (value) => String(value || '').split(/\s*\n\s*/).map((v) => v.trim()).filter(Boolean);
export const joinImages = (list) => Array.from(new Set(list.filter(Boolean))).join('\n');
