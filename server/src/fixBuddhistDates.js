import 'dotenv/config';
import { supabase } from './supabase.js';

const DATE_COLUMNS = ['receivedAt', 'appointment', 'appointmentEnd', 'completedAt'];
const THRESHOLD = '2100-01-01';

const shiftToGregorian = (isoString) => {
  const date = new Date(isoString);
  date.setUTCFullYear(date.getUTCFullYear() - 543);
  return date.toISOString();
};

const main = async () => {
  const seen = new Map();

  for (const column of DATE_COLUMNS) {
    const { data, error } = await supabase
      .from('requests')
      .select(`id, ${DATE_COLUMNS.join(',')}`)
      .gte(column, THRESHOLD);
    if (error) throw error;

    for (const row of data) {
      const existing = seen.get(row.id) || { id: row.id };
      seen.set(row.id, { ...existing, ...row });
    }
  }

  console.log(`Found ${seen.size} rows with corrupted (Buddhist-era) dates.`);

  let fixed = 0;
  for (const row of seen.values()) {
    const patch = {};
    for (const column of DATE_COLUMNS) {
      const value = row[column];
      if (value && new Date(value) >= new Date(THRESHOLD)) {
        patch[column] = shiftToGregorian(value);
      }
    }
    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase.from('requests').update(patch).eq('id', row.id);
    if (error) throw error;
    fixed += 1;
  }

  console.log(`Fixed ${fixed} rows.`);
};

main().catch((error) => {
  console.error('Fix failed:', error);
  process.exitCode = 1;
});
