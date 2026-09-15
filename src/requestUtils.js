export const formatDate = (value) => value ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '-';

// ข้อมูลที่นำเข้าจาก Excel ชุดเก่าบางส่วนเก็บแค่ชื่อไฟล์/พาธ (เช่น "DataServiceDR_Images/xxx.jpg")
// ไม่ใช่ URL รูปจริง (ไฟล์ต้นฉบับหาไม่พบแล้ว) จึงต้องแยกไว้ ไม่ให้ขึ้น <img> ที่โหลดไม่ได้
export const isViewableImageUrl = (value) => typeof value === 'string'
  && /^(https?:\/\/|data:image\/|\/)/i.test(value.trim());
