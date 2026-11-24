import crypto from 'node:crypto';
import express from 'express';
import { supabase } from './supabase.js';
import { storeImage, removeImage } from './storage.js';
import { broadcastRequestsChanged } from './events.js';

// ข้อความ LINE ต้องขึ้นต้นด้วยคำเหล่านี้ ถึงจะถือว่าเป็นคำสั่ง
// (กันไม่ให้ข้อความคุยเล่นทั่วไปในกลุ่มถูกตีความเป็นงานโดยไม่ตั้งใจ)
const TRIGGER_WORD = 'แจ้งเปิดงาน';
const CLOSE_TRIGGER_WORD = 'แจ้งปิดงาน';
const MOVE_TRIGGER_WORD = 'แจ้งย้ายงาน';

// สถานะที่ย้ายไปได้ (ตรงกับ STATUS_ORDER ใน App.jsx) + ชื่อเรียกสั้นๆ ที่คนพิมพ์กันจริง
const MOVE_STATUSES = ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'รอส่งสื่อตามวันที่ลูกค้ากำหนด', 'รออะไหล่', 'เสนอราคา', 'รอจัดคิวช่าง', 'เรียบร้อยปกติ', 'ยกเลิก'];
const STATUS_ALIASES = { 'รอเสนอราคา': 'เสนอราคา', 'จัดคิวช่าง': 'รอจัดคิวช่าง', 'เรียบร้อย': 'เรียบร้อยปกติ' };
// ย้ายไปสถานะเหล่านี้ = ต้องส่งช่างไปหน้างาน ลักษณะงานเป็น "แก้ไขหน้างาน" เสมอ
const ON_SITE_STATUSES = ['กำลังดำเนินการ', 'รอจัดคิวช่าง'];

const resolveStatus = (text) => {
  const cleaned = String(text || '').replace(/\s+/g, '');
  if (MOVE_STATUSES.includes(cleaned)) return cleaned;
  if (STATUS_ALIASES[cleaned]) return STATUS_ALIASES[cleaned];
  if (MOVE_STATUSES.includes(`รอ${cleaned}`)) return `รอ${cleaned}`;
  return null;
};

// "แจ้งย้ายงาน / เลข MAR006189 (หรือแค่ 006189) / ไปเสนอราคา"
// ย้ายไป "กำลังดำเนินการ" ใส่เพิ่มได้: "ผู้ดำเนินการ: ช่างบอย" / "เวลาเริ่ม: 09.30" / "เวลาสิ้นสุด: 17.00"
// (วันที่เริ่ม/วันที่สิ้นสุด แยกบรรทัดก็ได้ หรือใส่รวมในค่าเวลา เช่น "เวลาเริ่ม: 28/10/2569 09.30")
const MOVE_LABEL_TO_FIELD = {
  'ผู้ดำเนินการ': 'assignee',
  'ช่าง': 'assignee',
  'เวลาเริ่ม': 'startTime',
  'เวลาเริ่มต้น': 'startTime',
  'เวลาเริ่มงาน': 'startTime',
  'เวลาสิ้นสุด': 'endTime',
  'เวลาสิ้นสุดงาน': 'endTime',
  'เวลาเลิก': 'endTime',
  'เวลาเลิกงาน': 'endTime',
  'เวลาเสร็จ': 'endTime',
  'เสร็จ': 'endTime',
  'วันที่เริ่ม': 'startDate',
  'วันที่เริ่มงาน': 'startDate',
  'วันที่': 'startDate',
  'วันที่สิ้นสุด': 'endDate',
  'วันที่เสร็จ': 'endDate',
  'วันที่เริ่ม, เวลา': 'startDateTime',
  'วันที่เสร็จ, เวลา': 'endDateTime',
  'วันที่สิ้นสุด, เวลา': 'endDateTime',
};
const MOVE_LABEL_KEYS = Object.keys(MOVE_LABEL_TO_FIELD).sort((a, b) => b.length - a.length);

const parseMoveMessage = (lines) => {
  const fields = {};
  for (const line of lines.slice(1)) {
    const ticketMatch = line.match(/^(?:เลขที่งาน|เลขที่|เลข)\s*[:：]?\s*(\S+)/);
    if (ticketMatch) {
      fields.ticket = ticketMatch[1];
      continue;
    }
    const statusMatch = line.match(/^(?:ไป|สถานะ\s*[:：]?)\s*(.+)$/);
    if (statusMatch) {
      fields.statusText = statusMatch[1].trim();
      fields.status = resolveStatus(fields.statusText);
      continue;
    }
    // "ผู้ดำเนินการ: ช่างบอย" / "เวลาเริ่ม: 09.30" (มี : คั่น; greedy กัน label ที่มีลูกน้ำ เช่น "วันที่เริ่ม, เวลา")
    const labeledMatch = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    const label = labeledMatch ? MOVE_LABEL_TO_FIELD[labeledMatch[1].trim()] : null;
    if (label) {
      fields[label] = labeledMatch[2].trim();
      continue;
    }
    // "เวลาเริ่ม 09.30" (ไม่มี : ก็รับ)
    const inlineMatch = line.match(new RegExp(`^(${MOVE_LABEL_KEYS.join('|')})\\s+([^:：].*)$`));
    if (inlineMatch) {
      fields[MOVE_LABEL_TO_FIELD[inlineMatch[1]]] = inlineMatch[2].trim();
    }
  }
  return fields;
};

// รองรับหลายคำสะกดของแต่ละ label เผื่อพนักงานพิมพ์ไม่ตรงเป๊ะ
const LABEL_TO_FIELD = {
  'ลูกค้า': 'customer',
  'ชื่อลูกค้า': 'customer',
  'สถานที่': 'location',
  'สถานที่/สาขา': 'location',
  'สาขา': 'location',
  'ผู้ติดต่อ': 'contact',
  'เบอร์': 'phone',
  'เบอร์ติดต่อ': 'phone',
  'เบอร์โทร': 'phone',
  'ปัญหา': 'description',
  'ผู้ดำเนินการ': 'assignee',
  'การดำเนินการ': 'action',
  'รายละเอียดการดำเนินการ': 'action',
  // ข้อความแจ้งปิดงานที่ทีมเขียนจริง ใช้ "ชื่องาน" (มักรวมชื่อร้าน+สาขา) และ "รายละเอียดงาน"
  'ชื่องาน': 'jobName',
  'ชื่อร้าน': 'jobName',
  'รายละเอียดงาน': 'detail',
  'ลักษณะงาน': 'jobType',
  'อุปกรณ์': 'equipment',
  'เกี่ยวกับอุปกรณ์': 'equipment',
  // เวลาจริงที่เปิด/ปิดงาน เผื่อส่งข้อความทีหลัง เช่น "เวลา: 16.22"
  'เวลา': 'time',
  'เวลาแจ้ง': 'time',
  'เวลาเปิดงาน': 'time',
  'เวลาปิดงาน': 'time',
  'เวลาเสร็จ': 'time',
  // วันที่ (ใช้คู่กับเวลา ถ้าเขียนแยกบรรทัด) เช่น "วันที่เสร็จ: 28/10/2569" + "เวลา: 16.22"
  'วันที่': 'date',
  'วันที่แจ้ง': 'date',
  'วันที่เสร็จ': 'date',
  'วันที่ปิด': 'date',
  'วันที่ปิดงาน': 'date',
  // บางทีเขียนวันกับเวลารวมในบรรทัดเดียว: "วันที่เสร็จ, เวลา : 28/10/2569, 16.22"
  'วันที่, เวลา': 'dateTime',
  'วันที่เสร็จ, เวลา': 'dateTime',
};

// "16.22" / "16:22" / "16.22 น." / "17/10/2569 16.22" -> ISO string (เวลาไทย UTC+7) หรือ null ถ้าอ่านไม่ออก
// ไม่ระบุวันที่ = วันนี้ แต่ถ้าเวลานั้นยังมาไม่ถึง (เช่นส่ง "23.50" หลังเที่ยงคืน) ถือว่าเป็นของเมื่อวาน
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
export const parseThaiTime = (text, now = new Date()) => {
  const value = String(text || '').trim();
  const timeMatch = value.match(/(\d{1,2})\s*[.:：]\s*(\d{2})(?!\d)/);
  if (!timeMatch) return null;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;

  const dateMatch = value.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  let year = bangkokNow.getUTCFullYear();
  let month = bangkokNow.getUTCMonth();
  let day = bangkokNow.getUTCDate();
  if (dateMatch) {
    day = Number(dateMatch[1]);
    month = Number(dateMatch[2]) - 1;
    if (dateMatch[3]) {
      year = Number(dateMatch[3]);
      if (year < 100) year += year > 50 ? 2500 : 2000;
      if (year > 2400) year -= 543; // ปี พ.ศ.
    }
    if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  }

  let result = Date.UTC(year, month, day, hour, minute) - BANGKOK_OFFSET_MS;
  if (!dateMatch && result > now.getTime() + 5 * 60 * 1000) result -= 24 * 60 * 60 * 1000;
  return new Date(result).toISOString();
};

// รวม "วันที่เสร็จ: 28/10/2569" + "เวลา: 16.22" (หรือ "วันที่เสร็จ, เวลา : 28/10/2569, 16.22" บรรทัดเดียว)
// เป็นวันเวลาเดียวแล้วแปลง ถ้าใส่แค่วันที่โดยไม่มีเวลาก็แปลงไม่ได้ คืน null
const parseThaiDateTime = (fields) => {
  const combined = [fields.date, fields.time].filter(Boolean).join(' ');
  return parseThaiTime(combined) || parseThaiTime(fields.dateTime) || parseThaiTime(fields.time) || null;
};

const DONE_STATUSES = ['เรียบร้อยปกติ', 'ยกเลิก'];

// เทียบชื่อลูกค้า/สถานที่แบบไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างเกิน (รวม non-breaking space จาก Excel)
const normalizeText = (text) => String(text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// สร้างงานทันทีที่ได้ข้อความ "แจ้งเปิดงาน" แล้วรูปที่ส่งตามมาในกลุ่มเดียวกันภายในเวลานี้จะติดไปกับงานนั้น
// (เลือกรูปจากมือถือมักใช้เวลาหลายสิบวินาที รอสั้นๆ ไม่พอ)
const IMAGE_WINDOW_MS = 60 * 1000;

// key: "<groupId>:<userId>" (คนส่งในกลุ่มนั้น) -> งานล่าสุดที่คนนั้นแจ้งเปิด/ปิด
// { requestId, ticket, field: 'image' | 'completedImage', images: [{url, messageId}], pendingId, expiresAt }
const activeByGroup = new Map();

// LINE ส่งแต่ละรูปเป็นคนละ webhook ซึ่งอาจมาซ้อนกัน ต้องประมวลผลทีละอันต่อกลุ่ม
// ไม่งั้นนับจำนวนรูปพลาด (เช่น 2 รูปมาพร้อมกันแล้วต่างคนต่างคิดว่าเป็นรูปแรก)
const queueByGroup = new Map();
const runInGroupOrder = (groupKey, task) => {
  const next = (queueByGroup.get(groupKey) || Promise.resolve())
    .then(task)
    .catch((error) => {
      console.error('LINE: event handling failed', error);
      recordHit({ error: error?.message || JSON.stringify(error) });
    });
  queueByGroup.set(groupKey, next);
  return next;
};

// หัวข้อปิดงานต้องขึ้นต้นด้วยคำเหล่านี้ และสั้น (กันประโยคอย่าง "รบกวนเข้าแก้ไขปัญหาภายใน 48 ชม ... 12:57" ที่มี : จากเวลา)
const FIX_LABEL = /^((วิธี|แนวทาง(การ)?|การ)?แก้(ไข)?(ปัญหา)?|อ[ัะ]?[พป]เด[ทต]\s*เคส|update)\s*$/i;
// บรรทัดแรก "แจ้งงานใหม่" / "แจ้งงานซ่อมใหม่" = เปิดงานเสมอ ไม่ว่าข้างในจะมีคำว่าแก้ไข
const NEW_CASE_HEADER = /^\**\s*แจ้งงาน(ซ่อม)?ใหม่/;
// หัวข้อปิดงานที่พิมพ์ตามด้วยช่องว่างแทน : (เฉพาะคำที่ชัดเจน กันประโยคทั่วไปที่ขึ้นต้นด้วย "แก้ไข")
const NO_COLON_FIX = /^(วิธี(?:การ)?แก้(?:ไข)?|แนวทาง(?:การ)?แก้(?:ไข)?|อ[ัะ]?[พป]เด[ทต]\s*เคส)\s+([^:：\s].*)$/;
// ข้อความเคสจาก True: มี "ชื่อ Shop" + หัวข้อแก้ไข = ปิดงาน, มี "ชื่อ Shop" + "ปัญหา" (ไม่มีหัวข้อแก้ไข) = เปิดงาน
const parseTrueCase = (lines) => {
  const f = {};
  for (const line of lines) {
    // "วิธีแก้ไข แนะนำสาขา..." (ไม่มี : ) ก็นับเป็นหัวข้อปิดงาน
    const bareFix = line.match(NO_COLON_FIX);
    const match = bareFix ? [line, bareFix[1], bareFix[2]] : line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match || !match[2].trim()) continue;
    const label = match[1].trim();
    const value = match[2].replace(/^[:：\s]+/, '').trim();
    if (!value) continue;
    const key = FIX_LABEL.test(label) ? 'fix'
      : /^ชื่อ\s*shop/i.test(label) ? 'shop'
      : /^รายละเอียดปัญหา/.test(label) ? 'detail'
      : /^ปัญหา/.test(label) ? 'problem'
      : /^(ชื่อ)?ผู้แจ้ง/.test(label) ? 'contact'
      : /^เบอร์/.test(label) ? 'phone'
      : /^(ที่อยู่|อาคาร)/.test(label) ? 'site'
      : /^(เกี่ยวกับ)?อุปกรณ์/.test(label) ? 'equipment'
      : null;
    if (key && !f[key]) f[key] = value;
  }
  if (!f.shop) return null;
  const base = { customer: 'True', location: f.shop, jobName: f.shop };
  if (f.fix && !NEW_CASE_HEADER.test(lines[0])) return { kind: 'close', fields: { ...base, action: f.fix, equipment: f.equipment } };
  if (!f.problem && !f.detail) return null;
  return {
    kind: 'open',
    fields: { ...base, contact: f.contact, phone: f.phone, site: f.site, description: f.detail || f.problem },
  };
};

// รายงานจบงานของช่าง (ไม่มีคำว่า "แจ้งปิดงาน") เช่น
//   ผู้ดำเนินการ : เหน่ง หม่อง / ชื่องาน : Popmart / สถานที่ : Central Park
//   วันที่ : 20/11/26 - 20/11/26 / เวลา : 22:00 - 05:00 / รายละเอียดงาน : เปลี่ยนแผ่นเสีย 6 แผ่น / ทะเบียนรถ : 3167
// มี "ผู้ดำเนินการ" + "ชื่องาน" + "รายละเอียดงาน" = ปิดงาน (บรรทัด "สถานะ" ในรายงานไม่ใช้)
const OPERATOR_LABELS = {
  'ผู้ดำเนินการ': 'assignee',
  'ดำเนินการ': 'assignee', // บางคนพิมพ์ไม่มี "ผู้"
  'ชื่องาน': 'jobName',
  'สถานที่': 'place',
  'วันที่': 'date',
  'เวลา': 'time',
  'รายละเอียดงาน': 'action',
  'ทะเบียนรถ': 'vehicle',
  // รายงานแบบภาษาอังกฤษ (Manpower / Project / Date / Time / Details)
  'manpower': 'assignee',
  'project': 'jobName',
  'location': 'place',
  'date': 'date',
  'time': 'time',
  'details': 'action',
  'detail': 'action',
};
// วันจบ = วันที่ตัวหลัง + เวลาตัวหลัง ถ้าเวลาจบน้อยกว่าเวลาเริ่มในวันเดียวกัน (งานกลางคืน 22:00 - 05:00) = เช้าวันถัดไป
const operatorCompletedAt = (date, time) => {
  const dates = String(date || '').split(/\s*[-–~]\s*/).filter(Boolean);
  const times = String(time || '').match(/\d{1,2}\s*[.:]\s*\d{2}/g) || [];
  if (!times.length) return null;
  const endDate = dates[dates.length - 1] || '';
  const iso = parseThaiTime(`${endDate} ${times[times.length - 1]}`);
  if (!iso) return null;
  const crossesMidnight = times.length > 1 && dates.length <= 2 && (dates[0] || '') === endDate
    && parseThaiTime(`${endDate} ${times[times.length - 1]}`) < parseThaiTime(`${endDate} ${times[0]}`);
  return crossesMidnight ? new Date(new Date(iso).getTime() + 24 * 60 * 60 * 1000).toISOString() : iso;
};
const parseOperatorReport = (lines) => {
  const f = {};
  let inAction = false;
  for (const line of lines) {
    // บรรทัดที่เป็น "หัวข้อ : ค่า" (หัวข้อสั้นๆ ไม่ใช่ประโยค)
    const match = line.match(/^([^:：]{1,25}?)\s*[:：]\s*(.*)$/);
    const key = match && OPERATOR_LABELS[match[1].trim().toLowerCase()];
    if (key) {
      inAction = key === 'action';
      if (match[2].trim() && !f[key]) f[key] = match[2].trim();
      continue;
    }
    if (match) { inAction = false; continue; } // หัวข้ออื่น เช่น "สถานะ :", "Project Co. :"
    // บรรทัดอิสระที่ตามหลัง Details/รายละเอียดงาน = รายละเอียดต่อ (ข้าม @mention)
    if (inAction && !line.startsWith('@')) f.action = [f.action, line].filter(Boolean).join('\n');
  }
  if (!f.assignee || !f.jobName || !f.action) return null;
  return {
    kind: 'close',
    fields: {
      assignee: f.assignee,
      jobName: [f.jobName, f.place].filter(Boolean).join(' '),
      location: f.place,
      action: f.action,
      vehicle: f.vehicle,
      completedAtIso: operatorCompletedAt(f.date, f.time),
    },
  };
};

// คืนค่า { kind: 'open' | 'close', fields } หรือ null ถ้าไม่ใช่คำสั่ง
export const parseLineMessage = (text) => {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let kind = null;
  if (lines[0].startsWith(TRIGGER_WORD)) kind = 'open';
  else if (lines[0].startsWith(CLOSE_TRIGGER_WORD)) kind = 'close';
  else if (lines[0].startsWith(MOVE_TRIGGER_WORD)) return { kind: 'move', fields: parseMoveMessage(lines) };
  if (!kind) return parseTrueCase(lines) || parseOperatorReport(lines);

  const fields = {};
  for (const line of lines.slice(1)) {
    // "เลข 006189" / "เลขที่งาน: MAR006189" (ใช้ระบุงานตอนแจ้งปิดงาน มีหรือไม่มี : ก็ได้)
    const ticketMatch = line.match(/^(?:เลขที่งาน|เลขงาน|เลขที่|เลข)\s*[:：]?\s*([A-Za-z]*\d+)$/);
    if (ticketMatch) {
      fields.ticket = ticketMatch[1];
      continue;
    }
    // "เวลา 16.22" (ไม่มี :) ก็รับ
    const timeMatch = line.match(/^(?:เวลา(?:แจ้ง|เปิดงาน|ปิดงาน|เสร็จ)?)\s+(\d.*)$/);
    if (timeMatch) {
      fields.time = timeMatch[1].trim();
      continue;
    }
    // "วันที่เสร็จ 28/10/2569" (ไม่มี :) ก็รับ
    const dateMatch = line.match(/^(?:วันที่(?:เสร็จ|ปิดงาน|ปิด|แจ้ง)?)\s+(\d.*)$/);
    if (dateMatch) {
      fields.date = dateMatch[1].trim();
      continue;
    }
    const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    // "วันที่ , เวลา" (เว้นวรรคหน้า/หลังจุลภาค) = "วันที่, เวลา"
    const field = match ? LABEL_TO_FIELD[match[1].trim().replace(/\s*,\s*/g, ', ')] : null;
    if (field) {
      if (match[2].trim()) fields[field] = match[2].trim();
      continue;
    }
    // บรรทัดที่ไม่มีหัวข้อที่รู้จัก (เช่น "สถานะจอ Offline", "ลง Autorun ทั้ง 5 จอ") เก็บไว้รวมเป็นรายละเอียดงาน
    fields.extra = [...(fields.extra || []), line];
  }
  return { kind, fields };
};

const verifySignature = (rawBody, signature, channelSecret) => {
  if (!channelSecret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  // timingSafeEqual ต้องการ buffer ความยาวเท่ากัน เช็คความยาวก่อนกันโยน exception
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// เอาเฉพาะตัวอักษรอังกฤษ ไม่เอาตัวเลข: ชื่อลูกค้าภาษาไทยที่มีเลขปน (เช่น "ทดสอบระบบ02")
// จะได้เลขที่งานเป็นตัวเลขล้วน "02006197" ซึ่งรูปแบบ /^\D+\d+$/ จับเลขวิ่งไม่ได้ ทำให้เลขซ้ำ/ถอยหลัง
const buildTrackingPrefix = (customer = '') => {
  const cleaned = String(customer || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return cleaned || 'REQ';
};

// ลอจิกเดียวกับฝั่ง frontend (App.jsx: generateTrackingNumber) เลขวิ่งนับต่อเนื่องกันทั้งระบบ
// ไม่แยกนับใหม่ต่อลูกค้าแต่ละราย ให้ตรงกับที่มีอยู่จริงในฐานข้อมูล
const generateTicketNumber = async (customer) => {
  const prefix = buildTrackingPrefix(customer);
  const PAGE_SIZE = 1000;
  let from = 0;
  let maxNumber = 0;

  while (true) {
    const { data, error } = await supabase.from('requests').select('ticket').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data) {
      const match = typeof row.ticket === 'string' && row.ticket.match(/^\D+(\d{1,6})$/);
      if (match) maxNumber = Math.max(maxNumber, Number.parseInt(match[1], 10));
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return `${prefix}${String(maxNumber + 1).padStart(6, '0')}`;
};

const downloadLineImage = async (messageId, accessToken) => {
  const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to download LINE image ${messageId}: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const createRequestFromFields = async (fields) => {
  const ticket = await generateTicketNumber(fields.customer);
  const { data, error } = await supabase
    .from('requests')
    .insert({
      customer: fields.customer || '',
      ticket,
      ref: 'P1',
      source: 'ไลน์',
      location: fields.location || null,
      site: fields.site || null,
      contact: fields.contact || null,
      phone: fields.phone || null,
      description: fields.description || null,
      assignee: fields.assignee || null,
      action: fields.action || null,
      status: 'รับเรื่อง',
      // งานที่แจ้งเปิดผ่าน LINE เป็น "แนะนำ" เสมอ จะแก้ลักษณะงานตอนย้ายงาน/ปิดงานทีหลัง
      jobType: 'แนะนำ',
      ma: 'N',
      receivedAt: parseThaiDateTime(fields) || new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  broadcastRequestsChanged();
  return data;
};

// งานที่ยังไม่ปิดทั้งหมดของลูกค้า (+ สถานที่ ถ้าระบุมา) เรียงจากแจ้งล่าสุด
const findOpenRequests = async (fields) => {
  const { data, error } = await supabase
    .from('requests')
    .select('id, ticket, customer, location, receivedAt')
    .not('status', 'in', `(${DONE_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .order('receivedAt', { ascending: false });
  if (error) throw error;

  const customer = normalizeText(fields.customer);
  const location = normalizeText(fields.location);
  return data.filter((row) => normalizeText(row.customer) === customer
    && (!location || normalizeText(row.location) === location));
};

// ไม่ได้ระบุ "อุปกรณ์" ตอนปิดงาน: เดาจากข้อความการดำเนินการ/วิธีแก้ (เช่น "restart กล่อง" = กล่องเล่นสื่อ) ไม่เข้าเงื่อนไขไหน = จอ LED
export const guessEquipment = (text) => {
  const t = String(text || '').toLowerCase();
  if (/kiosk|คีออส|คีออช/.test(t)) return 'Kiosk';
  if (/กล่อง|box|player|เครื่องเล่น|บอร์ด|board|android|เฟิร์มแวร์|firmware|3399|3566|a3/.test(t)) return 'กล่องเล่นสื่อ';
  return 'จอ LED';
};

// ลักษณะงานตอนปิดงาน: เดาจากการดำเนินการ เข้าได้หมวดเดียว = ใช้เลย, ไม่เข้าหมวดไหน/เข้าหลายหมวด = ไม่แน่ใจ (null) ให้คนเลือกในเว็บ
export const CLOSE_JOB_TYPES = ['รีโมท', 'แก้ไขสื่อ', 'ขึ้นสื่อ', 'แก้ไขหน้างาน'];
export const guessJobType = (text, fields = {}) => {
  const t = String(text || '').toLowerCase();
  const hits = [];
  if (/รีโมท|remote|anydesk|teamviewer|ultraviewer|ทางไกล|แนะนำ/.test(t)) hits.push('รีโมท');
  if (/(แก้(ไข)?|อัพ|อัป|เปลี่ยน|อัพเดท|อัปเดต)\s*(ไฟล์)?\s*สื่อ|playlist|เพลย์ลิสต์|autorun|ออโต้รัน/.test(t)) hits.push('แก้ไขสื่อ');
  if (/(ขึ้น|ลง|ส่ง|ใส่)\s*(ไฟล์)?\s*สื่อ|ขึ้น(โฆษณา|แคมเปญ|campaign)|content|คอนเทนต์/.test(t)) hits.push('ขึ้นสื่อ');
  if (fields.vehicle || /หน้างาน|เข้า(ตรวจ|ไปตรวจ|ไปซ่อม|ไปเปลี่ยน|ซ่อม|เปลี่ยน|แก้|หน้างาน)|ลงพื้นที่|on\s*site|ซ่อม|เปลี่ยน\s*(แผ่น|โมดูล|module|power|psu|พาวเวอร์|การ์ด|card|สาย)|นั่งร้าน|ช่าง/.test(t)) hits.push('แก้ไขหน้างาน');
  return hits.length === 1 ? hits[0] : null;
};

export const applyClose = async (requestId, fields, completedAt) => {
  const updates = { status: 'เรียบร้อยปกติ', completedAt };
  if (fields.equipment) {
    updates.equipment = fields.equipment;
  } else {
    // งานที่มีอุปกรณ์อยู่แล้วไม่ทับ
    const { data: current } = await supabase.from('requests').select('equipment').eq('id', requestId).maybeSingle();
    if (!current?.equipment) updates.equipment = guessEquipment(fields.action);
  }
  if (fields.assignee) updates.assignee = fields.assignee;
  if (fields.action) updates.action = fields.action;
  if (fields.jobType) updates.jobType = fields.jobType;
  if (fields.vehicle) updates.vehicle = fields.vehicle;
  const { error } = await supabase.from('requests').update(updates).eq('id', requestId);
  if (error) throw error;
  broadcastRequestsChanged();
};

// คืนค่า { request } = ปิดแล้ว, { pendingCloseId } = เจอหลายงาน พักให้เลือกในเว็บ, null = ปิดไม่ได้
// แยกคำสำหรับเทียบความใกล้เคียง: ตัวพิมพ์เล็ก ตัดเครื่องหมาย ตัดคำทั่วไปที่ไม่ช่วยแยกงาน
const STOP_WORDS = new Set(['the', 'and', 'of', 'at', 'in', 'shop', 'fl', 'floor', 'ชั้น', 'สาขา', 'ร้าน']);
const tokensOf = (text) => normalizeText(text)
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

// หางานค้างที่น่าจะตรงกับข้อความ (ชื่องาน/สถานที่/ลูกค้า) เรียงจากคะแนนมากไปน้อย
// คะแนน = ความยาวรวมของคำที่เจอในงานนั้น (คำยาวอย่าง "ngamwongwan" มีน้ำหนักกว่าคำสั้น)
const findSimilarOpenRequests = async (fields, limit = 5) => {
  const queryTokens = [...new Set(tokensOf([fields.jobName, fields.location, fields.customer].filter(Boolean).join(' ')))];
  if (queryTokens.length === 0) return [];

  const { data, error } = await supabase
    .from('requests')
    .select('id, ticket, customer, location, site, description, receivedAt')
    .not('status', 'in', `(${DONE_STATUSES.map((s) => `"${s}"`).join(',')})`);
  if (error) throw error;

  return data
    .map((row) => {
      const haystack = normalizeText([row.customer, row.location, row.site, row.description, row.ticket].join(' '));
      const score = queryTokens.reduce((sum, token) => (haystack.includes(token) ? sum + token.length : sum), 0);
      return { row, score };
    })
    .filter(({ score }) => score >= 4)
    .sort((a, b) => b.score - a.score || String(b.row.receivedAt).localeCompare(String(a.row.receivedAt)))
    .slice(0, limit)
    .map(({ row }) => row);
};

const queuePendingClose = async (candidates, fields, completedAt, groupKey, extra) => {
  const { data, error } = await supabase
    .from('line_pending_closes')
    .insert({
      candidate_ids: candidates.map((m) => m.id),
      fields: {
        customer: fields.customer || null,
        location: fields.location || null,
        jobName: fields.jobName || null,
        assignee: fields.assignee || null,
        action: fields.action || null,
        jobType: fields.jobType || null,
        equipment: fields.equipment || null,
        vehicle: fields.vehicle || null,
        ...extra,
      },
      completed_at: completedAt,
      source_group_id: groupKey,
    })
    .select('id')
    .single();
  if (error) throw error;
  recordHit({ closePending: data.id, candidates: candidates.map((m) => m.ticket), fuzzy: Boolean(extra?.fuzzy) });
  return { pendingCloseId: data.id };
};

const closeRequestFromFields = async (fields, groupKey, rawText) => {
  const completedAt = fields.completedAtIso || parseThaiDateTime(fields) || new Date().toISOString();
  // ไม่มีหัวข้อ "การดำเนินการ" ก็ใช้รายละเอียดงาน + บรรทัดอิสระที่เหลือ (สิ่งที่ทำ/อาการ) แทน
  if (!fields.action) {
    const combined = [fields.detail, ...(fields.extra || [])].filter(Boolean).join('\n');
    if (combined) fields.action = combined;
  }
  // ลักษณะงาน: เขียนมาเองใช้ตามนั้น ไม่งั้นเดาจากการดำเนินการ เดาไม่ได้ = ส่งให้คนเลือกในเว็บก่อนปิด
  // ปิดงานแล้วไม่มีลักษณะงาน "แนะนำ" (ค่าตั้งต้นตอนเปิดงาน): เขียน "แนะนำ" มา = รีโมท
  if (/^แนะนำ/.test(String(fields.jobType || "").trim())) fields.jobType = "รีโมท";
  if (!CLOSE_JOB_TYPES.includes(fields.jobType)) fields.jobType = guessJobType(fields.action, fields) || undefined;
  const closeOrAsk = async (request) => {
    if (!fields.jobType) return queuePendingClose([request], fields, completedAt, groupKey, { needJobType: true });
    await applyClose(request.id, fields, completedAt);
    return { request };
  };

  // ระบุเลขงานมา = ปิดงานนั้นตรงๆ ไม่ต้องเทียบลูกค้า/สถานที่
  if (fields.ticket) {
    const { request, reason } = await findRequestByTicket(fields.ticket);
    if (!request) {
      recordHit({ closeSkipped: reason, ticket: fields.ticket });
      return null;
    }
    return closeOrAsk(request);
  }

  // ลูกค้า (+สถานที่) ตรงกันเป๊ะ: งานเดียวปิดเลย หลายงานให้เลือกในเว็บ (เหมือนเดิม)
  if (fields.customer) {
    const matches = await findOpenRequests(fields);
    if (matches.length === 1) return closeOrAsk(matches[0]);
    if (matches.length > 1) return queuePendingClose(matches, fields, completedAt, groupKey);
  }

  // ไม่มีเลขงาน และชื่อไม่ตรงเป๊ะ (เช่นเขียนแบบอิสระ "ชื่องาน: True Shop The Mall Ngamwongwan 6FL.")
  // ไม่ปิดเอง: หางานที่ใกล้เคียงที่สุดแล้วให้คนยืนยันในเว็บ แม้จะหาไม่เจอเลยก็แจ้งให้ใส่เลขงานเอง
  const similar = await findSimilarOpenRequests(fields);
  return queuePendingClose(similar, fields, completedAt, groupKey, { fuzzy: true, rawText: String(rawText || '').slice(0, 1500) });
};

// รูปที่พักไว้กับ "แจ้งปิดงาน" ที่รอเลือกงาน: เลือกงานแล้วค่อยใส่ (1 รูป = ใส่เลย, หลายรูป = ไปคิวเลือกรูป)
// งานหนึ่งเก็บได้หลายรูป: ช่อง image / completedImage เก็บ URL หลายอันคั่นด้วยขึ้นบรรทัดใหม่
export const splitImages = (value) => String(value || '').split(/\s*\n\s*/).map((v) => v.trim()).filter(Boolean);
// ต่อรูปใหม่ท้ายรูปที่งานมีอยู่แล้ว (ไม่ทับรูปเดิม)
const appendImages = async (requestId, field, urls) => {
  if (!urls.length) return;
  const { data: current, error: readError } = await supabase.from('requests').select(field).eq('id', requestId).maybeSingle();
  if (readError) throw readError;
  const merged = Array.from(new Set([...splitImages(current?.[field]), ...urls])).join('\n');
  const { error } = await supabase.from('requests').update({ [field]: merged }).eq('id', requestId);
  if (error) throw error;
};

// sourceGroupId ไม่ใช้แล้ว (เดิมใช้ส่งรูปหลายรูปไปคิวเลือกรูป) เก็บไว้ให้ที่เรียกเดิมยังใช้ได้
export const attachImagesToRequest = async (request, field, images, _sourceGroupId) => {
  await appendImages(request.id, field, images.map((img) => img.url));
  broadcastRequestsChanged();
};

// รับได้ทั้งเลขเต็ม (MAR006189) และเลขท้าย 6 หลักอย่างเดียว (006189) ไม่สนตัวพิมพ์ใหญ่เล็ก
const findRequestByTicket = async (ticketText) => {
  const wanted = String(ticketText || '').trim().toUpperCase();
  if (!wanted) return { request: null, reason: 'missing เลข' };

  const isDigitsOnly = /^\d+$/.test(wanted);
  const query = supabase.from('requests').select('id, ticket, status, completedAt');
  const { data, error } = isDigitsOnly
    ? await query.like('ticket', `%${wanted.padStart(6, '0')}`)
    : await query.ilike('ticket', wanted);
  if (error) throw error;

  const matches = isDigitsOnly
    ? data.filter((row) => (row.ticket.match(/(\d{1,6})$/)?.[1] || '').padStart(6, '0') === wanted.padStart(6, '0'))
    : data;
  if (matches.length === 0) return { request: null, reason: 'ticket not found' };
  if (matches.length > 1) return { request: null, reason: `ambiguous: ${matches.map((m) => m.ticket).join(', ')}` };
  return { request: matches[0] };
};

const moveRequestFromFields = async (fields) => {
  if (!fields.status) {
    recordHit({ moveSkipped: 'unknown status', statusText: fields.statusText || null });
    return null;
  }
  const { request, reason } = await findRequestByTicket(fields.ticket);
  if (!request) {
    recordHit({ moveSkipped: reason, ticket: fields.ticket || null });
    return null;
  }

  const updates = { status: fields.status };
  if (ON_SITE_STATUSES.includes(fields.status)) updates.jobType = 'แก้ไขหน้างาน';
  // ย้ายไป "กำลังดำเนินการ": ช่างลงหน้างานแล้ว เก็บผู้ดำเนินการ + เวลาเริ่ม/สิ้นสุดที่แจ้งมาด้วย (ถ้ามี)
  if (fields.status === 'กำลังดำเนินการ') {
    if (fields.assignee) updates.assignee = fields.assignee;
    const startAt = parseThaiTime([fields.startDate, fields.startTime].filter(Boolean).join(' '))
      || parseThaiTime(fields.startDateTime) || parseThaiTime(fields.startTime);
    if (startAt) updates.appointment = startAt;
    const endAt = parseThaiTime([fields.endDate, fields.endTime].filter(Boolean).join(' '))
      || parseThaiTime(fields.endDateTime) || parseThaiTime(fields.endTime);
    if (endAt) updates.appointmentEnd = endAt;
  }
  // ย้ายไปเรียบร้อยปกติ: ใส่วันเวลาเสร็จให้ด้วย (ถ้ายังไม่มี) ไม่งั้นรายงานประจำวันนับไม่เจอ
  if (fields.status === 'เรียบร้อยปกติ' && !request.completedAt) updates.completedAt = new Date().toISOString();

  const { error } = await supabase.from('requests').update(updates).eq('id', request.id);
  if (error) throw error;
  broadcastRequestsChanged();
  recordHit({ moved: request.ticket, from: request.status, to: fields.status });
  return request;
};

const handleTextMessage = async (groupKey, text) => {
  const parsed = parseLineMessage(text);
  if (!parsed) return; // ไม่ขึ้นต้นด้วยคำ trigger ถือเป็นข้อความคุยเล่นทั่วไป ไม่สนใจ

  if (parsed.kind === 'move') {
    activeByGroup.delete(groupKey); // ย้ายงานไม่มีรูป กันรูปที่ส่งตามมาไปติดงานที่เปิด/ปิดก่อนหน้า
    await moveRequestFromFields(parsed.fields);
    return;
  }

  if (parsed.kind === 'close') {
    const result = await closeRequestFromFields(parsed.fields, groupKey, text);
    if (!result) {
      activeByGroup.delete(groupKey); // ไม่ให้รูปที่ตามมาไปติดงานก่อนหน้าโดยไม่ตั้งใจ
      return;
    }
    if (result.pendingCloseId) {
      // ยังไม่รู้ว่าปิดงานไหน รูปที่ตามมาเก็บไว้กับรายการรอเลือกก่อน
      activeByGroup.set(groupKey, { pendingCloseId: result.pendingCloseId, images: [], expiresAt: Date.now() + IMAGE_WINDOW_MS });
      return;
    }
    const { request } = result;
    activeByGroup.set(groupKey, {
      requestId: request.id,
      ticket: request.ticket,
      field: 'completedImage',
      images: [],
      pendingId: null,
      expiresAt: Date.now() + IMAGE_WINDOW_MS,
    });
    console.log(`LINE: closed request ${request.ticket}`);
    recordHit({ closed: request.ticket });
    return;
  }

  const request = await createRequestFromFields(parsed.fields);
  activeByGroup.set(groupKey, {
    requestId: request.id,
    ticket: request.ticket,
    field: 'image',
    images: [],
    pendingId: null,
    expiresAt: Date.now() + IMAGE_WINDOW_MS,
  });
  console.log(`LINE: created request ${request.ticket}`);
  recordHit({ created: request.ticket });
};

// รูปที่ส่งตามมาหลัง "แจ้งเปิดงาน" (-> รูปที่แจ้ง) หรือ "แจ้งปิดงาน" (-> รูปงานเสร็จ):
// ทุกรูปต่อท้ายรูปของงานนั้น (เก็บได้หลายรูป)
const handleImageMessage = async (groupKey, messageId, accessToken, requestOrigin) => {
  const active = activeByGroup.get(groupKey);
  if (!active || Date.now() > active.expiresAt) {
    // รูปที่ส่งคุยกันทั่วไป ไม่ได้ตามหลังการแจ้งเปิด/ปิดงาน ไม่ต้องโหลดเก็บ
    recordHit({ imageIgnored: 'no แจ้งเปิดงาน/แจ้งปิดงาน from this sender in the last minute' });
    return;
  }

  const buffer = await downloadLineImage(messageId, accessToken);
  const url = await storeImage('service-desk-images', buffer, `${messageId}.jpg`, requestOrigin);
  active.images.push({ url, messageId });

  if (active.pendingCloseId) {
    const { error } = await supabase.from('line_pending_closes').update({ images: active.images }).eq('id', active.pendingCloseId);
    if (error) throw error;
    broadcastRequestsChanged();
    recordHit({ heldImageForPendingClose: active.pendingCloseId, imageCount: active.images.length });
    return;
  }

  // ทุกรูปที่ส่งตามมาใส่ให้งานทั้งหมด (งานหนึ่งเก็บได้หลายรูป ไม่ต้องไปเลือกรูปในเว็บแล้ว)
  await appendImages(active.requestId, active.field, [url]);
  broadcastRequestsChanged();
  recordHit({ attachedImage: active.ticket, imageCount: active.images.length });
};

export const lineRouter = express.Router();

// เก็บประวัติ webhook ล่าสุดไว้ดูผ่าน GET /api/line/debug เพราะดู log บน Render ไม่ได้
// ไม่เก็บค่าความลับหรือเนื้อหาข้อความเต็ม
const recentHits = [];
const recordHit = (entry) => {
  recentHits.unshift({ at: new Date().toISOString(), ...entry });
  recentHits.length = Math.min(recentHits.length, 20);
};

// ต้องอ่าน raw body (req.rawBody, capture ไว้ตอน express.json() ใน server.js) มาคำนวณลายเซ็นเทียบกับ
// header x-line-signature ถ้าไม่ตรง แปลว่าไม่ได้มาจาก LINE จริง ปฏิเสธทันที
lineRouter.post('/webhook', async (req, res) => {
  // trim กันช่องว่าง/ขึ้นบรรทัดที่ติดมาตอนวางค่าใน Render dashboard
  const channelSecret = (process.env.LINE_CHANNEL_SECRET || '').trim();
  const accessToken = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const signature = req.get('x-line-signature');

  const signatureOk = verifySignature(req.rawBody, signature, channelSecret);
  recordHit({
    signatureOk,
    hasSignatureHeader: Boolean(signature),
    events: (req.body?.events || []).map((e) => ({
      type: e.type,
      messageType: e.message?.type,
      sourceType: e.source?.type,
      command: e.message?.type === 'text' ? (parseLineMessage(e.message.text)?.kind || 'none') : undefined,
    })),
  });

  if (!signatureOk) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  // ตอบ 200 กลับไปก่อนทันที (LINE ต้องการคำตอบไว เดี๋ยว webhook จะถูกมองว่าใช้ไม่ได้) แล้วค่อยประมวลผลต่อ
  res.status(200).json({ ok: true });

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const events = req.body?.events || [];

  for (const event of events) {
    const chatKey = event.source?.groupId || event.source?.roomId || event.source?.userId;
    if (!chatKey) continue;
    // ผูกงานกับ "คนส่ง + กลุ่ม" ไม่ใช่แค่กลุ่ม: รูปจะติดกับงานก็ต่อเมื่อคนที่ส่ง
    // แจ้งเปิด/ปิดงานเป็นคนส่งรูปเอง กันกรณีเพื่อนในกลุ่มส่งรูปอื่นแทรกเข้ามาใน 1 นาทีนั้น
    const senderKey = `${chatKey}:${event.source?.userId || ''}`;

    if (event.type === 'message' && event.message?.type === 'text') {
      runInGroupOrder(senderKey, () => handleTextMessage(senderKey, event.message.text));
    } else if (event.type === 'message' && event.message?.type === 'image') {
      runInGroupOrder(senderKey, () => handleImageMessage(senderKey, event.message.id, accessToken, requestOrigin));
    }
  }
});

// ใช้ตรวจว่า LINE ยิง webhook มาถึงไหม และลายเซ็นผ่านไหม (บอกแค่ความยาวค่าความลับ ไม่บอกค่าจริง)
lineRouter.get('/debug', (_req, res) => {
  res.json({
    secretLength: (process.env.LINE_CHANNEL_SECRET || '').trim().length,
    tokenLength: (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim().length,
    recentHits,
  });
});

// รายการงานที่รอเลือกรูป (มีรูปแนบมากกว่า 1 รูปตอนแจ้งเปิดงานผ่าน LINE)
lineRouter.get('/pending-images', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('line_pending_images')
      .select('id, request_id, ticket, field, images, created_at, requests(customer, location, description)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending images', error: String(error) });
  }
});

// เลือกรูปที่จะใช้ -> ใส่ใน requests.image แล้วลบรูปที่ไม่ได้เลือกทิ้งจาก storage
lineRouter.post('/pending-images/:id/choose', async (req, res) => {
  try {
    const { data: pending, error: fetchError } = await supabase
      .from('line_pending_images')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!pending) return res.status(404).json({ message: 'Pending entry not found' });

    const chosenUrl = req.body?.url;
    if (!pending.images.some((img) => img.url === chosenUrl)) {
      return res.status(400).json({ message: 'url must be one of the pending images' });
    }

    const { error: updateError } = await supabase
      .from('requests')
      .update({ [pending.field || 'image']: chosenUrl })
      .eq('id', pending.request_id);
    if (updateError) throw updateError;

    await Promise.all(
      pending.images.filter((img) => img.url !== chosenUrl).map((img) => removeImage('service-desk-images', img.url)),
    );

    const { error: deleteError } = await supabase.from('line_pending_images').delete().eq('id', pending.id);
    if (deleteError) throw deleteError;

    broadcastRequestsChanged();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to choose image', error: String(error) });
  }
});

// ข้ามไปเลย ไม่ใส่รูปให้งานนี้ (ลบรูปที่พักไว้ทั้งหมดทิ้ง)
lineRouter.delete('/pending-images/:id', async (req, res) => {
  try {
    const { data: pending, error: fetchError } = await supabase
      .from('line_pending_images')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!pending) return res.status(404).json({ message: 'Pending entry not found' });

    await Promise.all(pending.images.map((img) => removeImage('service-desk-images', img.url)));

    const { error: deleteError } = await supabase.from('line_pending_images').delete().eq('id', pending.id);
    if (deleteError) throw deleteError;

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to skip pending images', error: String(error) });
  }
});

// "แจ้งปิดงาน" ที่ลูกค้า+สถานที่ซ้ำกันหลายงาน รอให้คนเลือกว่าจะปิดงานไหน
lineRouter.get('/pending-closes', async (_req, res) => {
  try {
    const { data: pendings, error } = await supabase
      .from('line_pending_closes')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const ids = [...new Set(pendings.flatMap((p) => p.candidate_ids))];
    const { data: jobs, error: jobsError } = ids.length
      ? await supabase.from('requests').select('id, ticket, customer, location, description, status, receivedAt').in('id', ids)
      : { data: [], error: null };
    if (jobsError) throw jobsError;
    const jobById = new Map(jobs.map((job) => [job.id, job]));

    res.json(pendings.map((p) => ({
      ...p,
      // งานที่ถูกปิด/ลบไปแล้วระหว่างรอ ไม่ต้องให้เลือก
      candidates: p.candidate_ids.map((id) => jobById.get(id)).filter((job) => job && !DONE_STATUSES.includes(job.status)),
    })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending closes', error: error?.message || String(error) });
  }
});

lineRouter.post('/pending-closes/:id/choose', async (req, res) => {
  try {
    const { data: pending, error: fetchError } = await supabase
      .from('line_pending_closes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!pending) return res.status(404).json({ message: 'Pending close not found' });

    let request;
    if (req.body?.ticket) {
      // ระบบเดางานผิด/หาไม่เจอ: คนพิมพ์เลขงานเองในเว็บ
      const found = await findRequestByTicket(req.body.ticket);
      if (!found.request) return res.status(404).json({ message: found.reason === 'ticket not found' ? 'ไม่พบเลขงานนี้' : `เลขงานไม่ชัดเจน (${found.reason})` });
      request = found.request;
    } else {
      const requestId = req.body?.requestId;
      if (!pending.candidate_ids.includes(requestId)) {
        return res.status(400).json({ message: 'requestId must be one of the candidates' });
      }
      const { data, error: requestError } = await supabase.from('requests').select('id, ticket').eq('id', requestId).single();
      if (requestError) throw requestError;
      request = data;
    }

    const savedType = pending.fields?.jobType === 'แนะนำ' ? 'รีโมท' : pending.fields?.jobType;
    const jobType = req.body?.jobType || (CLOSE_JOB_TYPES.includes(savedType) ? savedType : null);
    if (!jobType) return res.status(400).json({ message: 'เลือกลักษณะงานก่อนปิดงาน' });
    await applyClose(request.id, { ...pending.fields, jobType }, pending.completed_at);
    await attachImagesToRequest(request, 'completedImage', pending.images, pending.source_group_id);

    const { error: deleteError } = await supabase.from('line_pending_closes').delete().eq('id', pending.id);
    if (deleteError) throw deleteError;
    res.json({ ok: true, ticket: request.ticket });
  } catch (error) {
    res.status(500).json({ message: 'Failed to close chosen job', error: error?.message || String(error) });
  }
});

// ไม่ปิดงานไหนเลย (เช่น แจ้งมาผิด) ทิ้งรายการนี้และรูปที่พักไว้
lineRouter.delete('/pending-closes/:id', async (req, res) => {
  try {
    const { data: pending, error: fetchError } = await supabase
      .from('line_pending_closes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!pending) return res.status(404).json({ message: 'Pending close not found' });

    await Promise.all(pending.images.map((img) => removeImage('service-desk-images', img.url)));
    const { error: deleteError } = await supabase.from('line_pending_closes').delete().eq('id', pending.id);
    if (deleteError) throw deleteError;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to dismiss pending close', error: error?.message || String(error) });
  }
});
