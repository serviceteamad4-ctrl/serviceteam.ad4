import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import 'dotenv/config';
import { supabase } from './supabase.js';

const filePath = path.resolve(process.cwd(), '../DataServiceDR.xlsx');
const BATCH_SIZE = 200;

const toIso = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
};

const toText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

// สเปรดชีตอ้างอิงรูปเป็น path ในเครื่อง (เช่น DataServiceDR_Images/xxx.jpg) ซึ่งไฟล์จริงไม่ได้อยู่บนเซิร์ฟเวอร์
// เก็บเป็นค่าว่างไว้ก่อน เพราะเก็บ path นั้นตรงๆ จะใช้แสดงรูปในแอปไม่ได้อยู่ดี
const toImage = () => null;

const normalizeRow = (row) => ({
  ref: toText(row['Ref.']),
  source: toText(row['แหล่งที่มา']),
  receivedAt: toIso(row['วันเวลาที่รับแจ้ง']),
  ticket: toText(row['เลขที่ติดตามงาน']),
  customer: toText(row['ลูกค้า']) || '',
  location: toText(row['สถานที่/สาขา']),
  site: toText(row['สถานที่ตั้ง']),
  contact: toText(row['ผู้ติดต่อ']),
  phone: toText(row['เบอร์ติดต่อ']),
  description: toText(row['ข้อมูลการรับแจ้ง']),
  image: toImage(row['รูปภาพที่แจ้ง']),
  ma: toText(row['MA']) || 'N',
  jobType: toText(row['ลักษณะงาน']),
  status: toText(row['สถานะงาน']),
  assignee: toText(row['ผู้ดำเนินการ']),
  appointment: toIso(row['วันที่นัดหมาย เวลาเริ่มต้น']),
  appointmentEnd: toIso(row['วันที่นัดหมาย เวลาสิ้นสุด']),
  action: toText(row['รายละเอียดการดำเนินการ']),
  result: toText(row['ผลการดำเนินการ']),
  equipment: toText(row['เกี่ยวกับอุปกรณ์']),
  completedImage: toImage(row['รูปภาพที่ดำเนินการเสร็จแล้ว']),
  completedAt: toIso(row['วันเวลาเสร็จ']),
  map: toText(row['MAP']),
  vehicle: toText(row['ทะเบียนรถ']),
  notes: toText(row['หมายเหตุ']),
  file: toText(row['ไฟล์']),
});

// ดึงเลขติดตามงานที่มีอยู่แล้วในฐานข้อมูลทั้งหมด เพื่อนำเข้าเฉพาะแถวใหม่ที่ยังไม่เคยมี
// ป้องกันข้อมูลซ้ำเวลารันสคริปต์นี้ซ้ำ หรือไฟล์ excel มีข้อมูลเก่าปนมาด้วย
const fetchExistingTickets = async () => {
  const existing = new Set();
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('requests').select('ticket').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    data.forEach((row) => { if (row.ticket) existing.add(row.ticket); });
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return existing;
};

const main = async () => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets['DataServiceDR'];
    if (!sheet) {
      throw new Error('Sheet "DataServiceDR" not found in workbook');
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });
    const existingTickets = await fetchExistingTickets();

    const seenInFile = new Set();
    const payload = [];
    rows.forEach((row) => {
      const ticket = toText(row['เลขที่ติดตามงาน']);
      if (!ticket || seenInFile.has(ticket) || existingTickets.has(ticket)) return;
      seenInFile.add(ticket);
      payload.push(normalizeRow(row));
    });

    console.log(`Found ${rows.length} rows in file, ${payload.length} are new (not already in the database).`);

    let imported = 0;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from('requests').insert(batch).select('id');
      if (error) throw error;
      imported += data.length;
      console.log(`Imported ${imported}/${payload.length}`);
    }

    console.log(`Done. Imported ${imported} new records from Excel into Supabase.`);
  } catch (error) {
    console.error('Excel import failed:', error);
    process.exitCode = 1;
  }
};

main();
