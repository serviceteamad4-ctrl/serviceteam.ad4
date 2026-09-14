import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { supabase } from './supabase.js';

const filePath = path.resolve(process.cwd(), '../service-desk-2026-08-28 (1).csv');

const toDate = (value) => {
  if (!value || !String(value).trim()) return null;
  const text = String(value).trim();
  if (!text) return null;

  const isoLike = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(isoLike);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeRow = (row) => ({
  customer: row['ลูกค้า'] || '',
  ref: row['Ref.'] || row['ระดับ'] || null,
  source: row['ช่องทาง'] || null,
  receivedAt: toDate(row['วันเวลารับแจ้ง']),
  ticket: row['เลขติดตาม'] || null,
  location: row['สถานที่'] || null,
  contact: row['ผู้ติดต่อ'] || null,
  description: row['รายละเอียด'] || null,
  jobType: row['ลักษณะงาน'] || null,
  status: row['สถานะ'] || null,
  assignee: row['ผู้ดำเนินการ'] || null,
  appointment: toDate(row['วันเวลานัดหมาย']),
  completedAt: toDate(row['วันเวลาเสร็จ']),
  action: row['การดำเนินการ'] || null,
  notes: row['หมายเหตุ'] || null,
});

const main = async () => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`CSV not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf8')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\uFEFF/g, '');

    const rows = parse(csvContent, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
    });

    const payload = rows.map(normalizeRow);

    const { data, error } = await supabase.from('requests').insert(payload).select('id');
    if (error) throw error;

    console.log(`Imported ${data.length} records from CSV into Supabase.`);
  } catch (error) {
    console.error('CSV import failed:', error);
    process.exitCode = 1;
  }
};

main();
