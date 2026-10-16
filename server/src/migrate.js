import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(currentDir, 'migrations');

// รันทุกไฟล์ .sql ใน migrations/ เรียงตามชื่อไฟล์ ทุกไฟล์เขียนเป็น "CREATE TABLE IF NOT EXISTS" ไว้แล้ว
// เรียกซ้ำกี่ครั้งก็ปลอดภัย จึงเรียกตอนเซิร์ฟเวอร์ start ได้เลยโดยไม่ต้องมี migration-tracking table แยกต่างหาก
//
// เครื่อง dev เครื่องนี้ต่อ Postgres ตรงของ Supabase (DATABASE_URL, พอร์ต 5432) ไม่ได้ เพราะ host เป็น
// IPv6-only แต่เครือข่ายเครื่องนี้ไม่มี route ออก IPv6 ให้ DNS ขึ้น ENOTFOUND ฝั่ง Render ไม่น่าเจอปัญหานี้
// จึงให้รันผ่าน server.js ตอน start แทน ไม่ต้องรันจากเครื่องนี้
export const runMigrations = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL is not set, skipping migrations');
    return;
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }
    console.log('Migrations complete.');
  } finally {
    await client.end();
  }
};

// เรียกตรงจาก CLI (node src/migrate.js) ได้เหมือนเดิม นอกเหนือจากที่ server.js เรียกตอน start
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runMigrations().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}
