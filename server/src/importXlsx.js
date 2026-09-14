import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import 'dotenv/config';
import { supabase } from './supabase.js';

const filePath = path.resolve(process.cwd(), '../DataServiceDR (1).xlsx');
const BATCH_SIZE = 500;

const toIso = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
};

const toText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

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
  image: toText(row['รูปภาพที่แจ้ง']),
  ma: toText(row['MA']) || 'N',
  jobType: toText(row['ลักษณะงาน']),
  status: toText(row['สถานะงาน']),
  assignee: toText(row['ผู้ดำเนินการ']),
  appointment: toIso(row['วันที่นัดหมาย เวลาเริ่มต้น']),
  appointmentEnd: toIso(row['วันที่นัดหมาย เวลาสิ้นสุด']),
  action: toText(row['รายละเอียดการดำเนินการ']),
  result: toText(row['ผลการดำเนินการ']),
  equipment: toText(row['เกี่ยวกับอุปกรณ์']),
  completedImage: toText(row['รูปภาพที่ดำเนินการเสร็จแล้ว']),
  completedAt: toIso(row['วันเวลาเสร็จ']),
  map: toText(row['MAP']),
  vehicle: toText(row['ทะเบียนรถ']),
  notes: toText(row['หมายเหตุ']),
  file: toText(row['ไฟล์']),
});

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
    const payload = rows.map(normalizeRow);

    let imported = 0;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from('requests').insert(batch).select('id');
      if (error) throw error;
      imported += data.length;
      console.log(`Imported ${imported}/${payload.length}`);
    }

    console.log(`Done. Imported ${imported} records from Excel into Supabase.`);
  } catch (error) {
    console.error('Excel import failed:', error);
    process.exitCode = 1;
  }
};

main();
