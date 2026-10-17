import crypto from 'node:crypto';
import express from 'express';
import { supabase } from './supabase.js';
import { storeImage, removeImage } from './storage.js';

// ข้อความ LINE ต้องขึ้นต้นด้วยคำเหล่านี้ ถึงจะถือว่าเป็นคำสั่ง
// (กันไม่ให้ข้อความคุยเล่นทั่วไปในกลุ่มถูกตีความเป็นงานโดยไม่ตั้งใจ)
const TRIGGER_WORD = 'แจ้งเปิดงาน';
const CLOSE_TRIGGER_WORD = 'แจ้งปิดงาน';

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

// คืนค่า { kind: 'open' | 'close', fields } หรือ null ถ้าไม่ใช่คำสั่ง
export const parseLineMessage = (text) => {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let kind = null;
  if (lines[0].startsWith(TRIGGER_WORD)) kind = 'open';
  else if (lines[0].startsWith(CLOSE_TRIGGER_WORD)) kind = 'close';
  if (!kind) return null;

  const fields = {};
  for (const line of lines.slice(1)) {
    const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    const field = LABEL_TO_FIELD[label];
    if (field && value) {
      fields[field] = value;
    }
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
      source: 'ไลน์',
      location: fields.location || null,
      contact: fields.contact || null,
      phone: fields.phone || null,
      description: fields.description || null,
      assignee: fields.assignee || null,
      action: fields.action || null,
      status: 'รับเรื่อง',
      ma: 'N',
      receivedAt: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// หางานที่ยังไม่ปิดของลูกค้า (+ สถานที่ ถ้าระบุมา) ถ้ามีหลายงาน เลือกงานที่แจ้งเข้ามาล่าสุด
const findOpenRequest = async (fields) => {
  const { data, error } = await supabase
    .from('requests')
    .select('id, ticket, customer, location, receivedAt')
    .not('status', 'in', `(${DONE_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .order('receivedAt', { ascending: false });
  if (error) throw error;

  const customer = normalizeText(fields.customer);
  const location = normalizeText(fields.location);
  return data.find((row) => normalizeText(row.customer) === customer
    && (!location || normalizeText(row.location) === location)) || null;
};

const closeRequestFromFields = async (fields) => {
  if (!fields.customer) {
    recordHit({ closeSkipped: 'missing ลูกค้า' });
    return null;
  }
  const request = await findOpenRequest(fields);
  if (!request) {
    recordHit({ closeSkipped: 'no open job found', customer: fields.customer, location: fields.location || null });
    return null;
  }

  const updates = { status: 'เรียบร้อยปกติ', completedAt: new Date().toISOString() };
  if (fields.assignee) updates.assignee = fields.assignee;
  if (fields.action) updates.action = fields.action;

  const { error } = await supabase.from('requests').update(updates).eq('id', request.id);
  if (error) throw error;
  return request;
};

const handleTextMessage = async (groupKey, text) => {
  const parsed = parseLineMessage(text);
  if (!parsed) return; // ไม่ขึ้นต้นด้วยคำ trigger ถือเป็นข้อความคุยเล่นทั่วไป ไม่สนใจ

  if (parsed.kind === 'close') {
    const request = await closeRequestFromFields(parsed.fields);
    if (!request) {
      activeByGroup.delete(groupKey); // ไม่ให้รูปที่ตามมาไปติดงานก่อนหน้าโดยไม่ตั้งใจ
      return;
    }
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
// รูปแรกใส่ให้งานเลย ถ้ามีรูปที่ 2 ขึ้นไป ไม่เดาเอง ถอดรูปออกแล้วย้ายทุกรูปไปพักใน
// line_pending_images ให้คนเลือกในหน้าเว็บ
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

  if (active.images.length === 1) {
    const { error } = await supabase.from('requests').update({ [active.field]: url }).eq('id', active.requestId);
    if (error) throw error;
  } else if (!active.pendingId) {
    const { error: clearError } = await supabase.from('requests').update({ [active.field]: null }).eq('id', active.requestId);
    if (clearError) throw clearError;
    const { data, error } = await supabase
      .from('line_pending_images')
      .insert({ request_id: active.requestId, ticket: active.ticket, field: active.field, images: active.images, source_group_id: groupKey })
      .select('id')
      .single();
    if (error) throw error;
    active.pendingId = data.id;
  } else {
    const { error } = await supabase.from('line_pending_images').update({ images: active.images }).eq('id', active.pendingId);
    if (error) throw error;
  }
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
