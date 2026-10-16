import crypto from 'node:crypto';
import express from 'express';
import { supabase } from './supabase.js';
import { storeImage, removeImage } from './storage.js';

// ข้อความ LINE ต้องขึ้นต้นด้วยคำนี้ก่อน ถึงจะถือว่าเป็นการแจ้งเปิดงานใหม่
// (กันไม่ให้ข้อความคุยเล่นทั่วไปในกลุ่มถูกตีความเป็นงานโดยไม่ตั้งใจ)
const TRIGGER_WORD = 'แจ้งเปิดงาน';

// รองรับหลายคำสะกดของแต่ละ label เผื่อพนักงานพิมพ์ไม่ตรงเป๊ะ
const LABEL_TO_FIELD = {
  'ลูกค้า': 'customer',
  'สถานที่': 'location',
  'สถานที่/สาขา': 'location',
  'สาขา': 'location',
  'ผู้ติดต่อ': 'contact',
  'เบอร์': 'phone',
  'เบอร์ติดต่อ': 'phone',
  'เบอร์โทร': 'phone',
  'ปัญหา': 'description',
};

// รอข้อความ/รูปที่ตามมาจากกลุ่มเดียวกันสักครู่ก่อนสรุปผล เพราะ LINE ส่งแต่ละรูปเป็นคนละ event
// ถึงผู้ใช้จะเลือกส่งพร้อมกันหลายรูปในแชทก็ตาม
const COLLECT_WINDOW_MS = 6000;

// key: groupId (หรือ userId ถ้าทักมาเดี่ยวๆ) -> { fields, images: [{url, messageId}], timer }
const pendingByGroup = new Map();

export const parseLineMessage = (text) => {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  if (!lines[0].startsWith(TRIGGER_WORD)) return null;

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
  return fields;
};

const verifySignature = (rawBody, signature, channelSecret) => {
  if (!channelSecret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
  // timingSafeEqual ต้องการ buffer ความยาวเท่ากัน เช็คความยาวก่อนกันโยน exception
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const buildTrackingPrefix = (customer = '') => {
  const cleaned = String(customer || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
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
      status: 'รับเรื่อง',
      ma: 'N',
      receivedAt: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ปิดรอบ: สร้างงานจริง + ใส่รูปตามจำนวนที่ได้รับ (0 = ไม่ใส่, 1 = ใส่เลย, 2+ = พักไว้ให้เลือกในเว็บ)
const finalizePending = async (groupKey) => {
  const pending = pendingByGroup.get(groupKey);
  if (!pending) return;
  pendingByGroup.delete(groupKey);

  try {
    const request = await createRequestFromFields(pending.fields);

    if (pending.images.length === 1) {
      await supabase.from('requests').update({ image: pending.images[0].url }).eq('id', request.id);
    } else if (pending.images.length > 1) {
      await supabase.from('line_pending_images').insert({
        request_id: request.id,
        ticket: request.ticket,
        images: pending.images,
        source_group_id: groupKey,
      });
    }
    console.log(`LINE: created request ${request.ticket} (${pending.images.length} image(s))`);
    recordHit({ created: request.ticket, images: pending.images.length });
  } catch (error) {
    console.error('LINE: failed to finalize pending request', error);
    recordHit({ finalizeError: error?.message || JSON.stringify(error) });
  }
};

const handleTextMessage = (groupKey, text) => {
  const fields = parseLineMessage(text);
  if (!fields) return; // ไม่ขึ้นต้นด้วยคำ trigger ถือเป็นข้อความคุยเล่นทั่วไป ไม่สนใจ

  const existing = pendingByGroup.get(groupKey);
  if (existing) clearTimeout(existing.timer);

  const entry = { fields, images: existing?.images || [] };
  entry.timer = setTimeout(() => finalizePending(groupKey), COLLECT_WINDOW_MS);
  pendingByGroup.set(groupKey, entry);
};

const handleImageMessage = async (groupKey, messageId, accessToken, requestOrigin) => {
  // รูปอาจส่งมาก่อนข้อความ trigger (เรียงไม่แน่นอน) ถ้ายังไม่มี pending ของกลุ่มนี้ให้รอเงียบๆ ไว้ก่อน
  // (สร้าง entry เปล่าไว้ก่อน ถ้าไม่มีข้อความ trigger ตามมาเลยภายใน window ก็จะไม่ถูกสร้างเป็นงาน)
  let entry = pendingByGroup.get(groupKey);
  if (!entry) {
    entry = { fields: null, images: [] };
    pendingByGroup.set(groupKey, entry);
  }

  try {
    const buffer = await downloadLineImage(messageId, accessToken);
    const url = await storeImage('service-desk-images', buffer, `${messageId}.jpg`, requestOrigin);
    entry.images.push({ url, messageId });
  } catch (error) {
    console.error('LINE: failed to download/store image', messageId, error);
  }

  if (entry.fields) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => finalizePending(groupKey), COLLECT_WINDOW_MS);
  }
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
      startsWithTrigger: e.message?.type === 'text' ? String(e.message.text || '').trim().startsWith(TRIGGER_WORD) : undefined,
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
    const groupKey = event.source?.groupId || event.source?.roomId || event.source?.userId;
    if (!groupKey) continue;

    if (event.type === 'message' && event.message?.type === 'text') {
      handleTextMessage(groupKey, event.message.text);
    } else if (event.type === 'message' && event.message?.type === 'image') {
      await handleImageMessage(groupKey, event.message.id, accessToken, requestOrigin);
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
      .select('id, request_id, ticket, images, created_at, requests(customer, location, description)')
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
      .update({ image: chosenUrl })
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
