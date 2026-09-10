import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

const XLSX = xlsx;

const root = path.dirname(fileURLToPath(import.meta.url));
const candidates = fs.readdirSync(root)
  .filter((name) => /^DataServiceDR.*\.xlsx$/i.test(name))
  .sort();
const workbookPath = path.join(root, candidates[0] || 'DataServiceDR.xlsx');
const apiUrl = `${process.env.API_URL || 'http://localhost:4001'}/api/requests`;

const aliases = {
  customer: ['ลูกค้า', 'Customer', 'Customer Name'],
  ref: ['Ref.', 'Ref', 'ref', 'ระดับ', 'Level'],
  source: ['ช่องทาง', 'แหล่งที่มา', 'Source', 'Channel'],
  receivedAt: ['วันเวลารับแจ้ง', 'วันเวลาที่รับแจ้ง', 'Received At', 'Date Received', 'วันที่รับแจ้ง'],
  ticket: ['เลขติดตาม', 'เลขที่ติดตามงาน', 'Ticket', 'Tracking Number', 'เลขติดตามงาน'],
  location: ['สถานที่', 'สถานที่/สาขา', 'Location', 'Site', 'สถานที่ติดตั้ง'],
  site: ['สถานที่ตั้ง', 'Site Address'],
  contact: ['ผู้ติดต่อ', 'Contact', 'Contact Name'],
  phone: ['Phone', 'เบอร์ติดต่อ', 'เบอร์โทร', 'โทรศัพท์'],
  description: ['รายละเอียด', 'ข้อมูลการรับแจ้ง', 'Description', 'Issue Detail'],
  image: ['รูปภาพที่แจ้ง', 'Image'],
  ma: ['MA'],
  jobType: ['ลักษณะงาน', 'Job Type', 'ประเภทงาน'],
  status: ['สถานะ', 'สถานะงาน', 'Status'],
  assignee: ['ผู้ดำเนินการ', 'Assignee', 'Technician'],
  appointment: ['วันเวลานัดหมาย', 'วันที่นัดหมาย เวลาเริ่มต้น', 'Appointment', 'Scheduled Time'],
  appointmentEnd: ['วันที่นัดหมาย เวลาสิ้นสุด', 'Appointment End'],
  action: ['การดำเนินการ', 'Action', 'Work Done'],
  result: ['ผลการดำเนินการ', 'Result'],
  equipment: ['เกี่ยวกับอุปกรณ์', 'Equipment'],
  completedImage: ['รูปภาพที่ดำเนินการเสร็จแล้ว', 'Completed Image'],
  completedAt: ['วันเวลาเสร็จ', 'วันเวลาเสร็จ', 'Completed At', 'Finished At'],
  map: ['MAP', 'Map'],
  vehicle: ['ทะเบียนรถ', 'Vehicle'],
  notes: ['หมายเหตุ', 'Notes', 'Remark'],
  file: ['ไฟล์', 'File'],
};

const dateFields = new Set(['receivedAt', 'appointment', 'appointmentEnd', 'completedAt']);
const latestSourceDate = Date.parse(process.env.LATEST_SOURCE_DATE || '2026-08-28T23:59:59+07:00');
const cleanHeader = (value) => String(value ?? '').trim();
const cleanString = (value) => value == null ? '' : String(value).trim();
const normalizeYear = (date) => {
  if (date.getUTCFullYear() >= 2400) {
    date.setUTCFullYear(date.getUTCFullYear() - 543);
  }
  if (date.getTime() > latestSourceDate) {
    date.setUTCFullYear(date.getUTCFullYear() - 1);
  }
  return date.toISOString();
};
const dateValue = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date) return normalizeYear(new Date(value));
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return normalizeYear(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0)));
  }
  const text = String(value).trim();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : normalizeYear(parsed);
};

const valueFor = (row, names) => {
  const entries = Object.entries(row);
  const match = entries.find(([key, value]) => names.includes(cleanHeader(key)) && value != null && value !== '');
  return match?.[1];
};

const payloadFor = (row) => Object.fromEntries(Object.entries(aliases).map(([field, names]) => [
  field,
  dateFields.has(field) ? dateValue(valueFor(row, names)) : cleanString(valueFor(row, names)),
]));

if (!fs.existsSync(workbookPath)) throw new Error(`ไม่พบไฟล์ Excel: ${workbookPath}`);
const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const rows = workbook.SheetNames.flatMap((sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(payloadFor);
});

console.log(`กำลังอ่านไฟล์: ${workbookPath}`);
console.log(`พบข้อมูลทั้งหมด ${rows.length} rows จาก ${workbook.SheetNames.length} sheets`);

const existingResponse = await fetch(apiUrl);
if (!existingResponse.ok) throw new Error(`อ่านข้อมูลเดิมไม่สำเร็จ (${existingResponse.status})`);
const existingRows = await existingResponse.json();
const rowKey = (row) => row.ticket
  ? `ticket:${row.ticket}`
  : `fallback:${row.customer}|${row.completedAt || ''}|${row.assignee || ''}|${row.notes || ''}`;
const existingByKey = new Map(existingRows.map((row) => [rowKey(row), row]));
const dataRows = rows.filter((row) => row.customer || row.ticket || row.description);
const pendingRows = dataRows.filter((row) => !existingByKey.has(rowKey(row)));
const updateRows = dataRows.filter((row) => existingByKey.has(rowKey(row)));
console.log(`พบข้อมูลเดิมสำหรับอัปเดต ${updateRows.length} rows`);
console.log(`เหลือข้อมูลใหม่ที่ต้องนำเข้า ${pendingRows.length} rows`);

let success = 0;
let failed = 0;
const importRow = async (payload, index) => {
  try {
    const existing = existingByKey.get(rowKey(payload));
    const response = await fetch(existing ? `${apiUrl}/${existing.id}` : apiUrl, {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      failed += 1;
      console.error(`Row ${index + 1} failed (${response.status}): ${await response.text()}`);
      return;
    }
    success += 1;
  } catch (error) {
    failed += 1;
    console.error(`Row ${index + 1} exception: ${error.message}`);
  }
};

for (let start = 0; start < dataRows.length; start += 8) {
  const batch = dataRows.slice(start, start + 8);
  await Promise.all(batch.map((payload, offset) => importRow(payload, start + offset)));
  console.log(`ส่งแล้ว ${Math.min(start + batch.length, dataRows.length)}/${dataRows.length} rows`);
}

console.log(`Import complete: success=${success}, failed=${failed}`);
if (failed > 0) process.exitCode = 1;
