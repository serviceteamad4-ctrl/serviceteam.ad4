import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { supabase } from './supabase.js';
import { storeImage, removeImage, UPLOAD_DIR } from './storage.js';

const app = express();
// Render (และ reverse proxy อื่นๆ) เชื่อม TLS เข้ามาแล้วส่งต่อเป็น http ภายใน
// ถ้าไม่ตั้งค่านี้ req.protocol จะรายงานเป็น "http" เสมอ ทำให้ URL รูปที่ fallback ไปเก็บบนดิสก์ผิดเป็น http://
app.set('trust proxy', true);
const PORT = Number(process.env.PORT || 4001);

const REQUEST_COLUMNS = [
  'id', 'customer', 'ref', 'source', 'receivedAt', 'ticket', 'location', 'site',
  'contact', 'phone', 'description', 'image', 'ma', 'jobType', 'status', 'assignee',
  'appointment', 'appointmentEnd', 'action', 'result', 'equipment', 'completedImage',
  'completedAt', 'map', 'vehicle', 'notes', 'file', 'createdAt', 'updatedAt',
];

// ตัด "/" ท้ายออกก่อนเทียบ กัน FRONTEND_URL ที่ตั้งไว้ผิดแบบมี/ไม่มี "/" ต่อท้ายแล้วเทียบไม่ตรง
const normalizeOrigin = (value) => String(value || '').replace(/\/+$/, '');

app.use(cors({
  origin: (origin, callback) => {
    const isLocalFrontend = !origin
      || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
    // อนุญาต *.onrender.com ทุกตัวไว้เลย เผื่อ FRONTEND_URL ยังตั้งไม่ตรง/ยังไม่ได้ตั้ง จะได้ไม่ล่มเวลา deploy ครั้งแรก
    const isOnRender = origin && /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);
    const isConfiguredFrontend = origin && normalizeOrigin(origin) === normalizeOrigin(process.env.FRONTEND_URL);

    callback(null, isLocalFrontend || isOnRender || isConfiguredFrontend);
  },
  credentials: true,
}));
// รูป 10 MB เมื่อเข้ารหัส base64 จะโตขึ้น ~33% จึงต้องเผื่อ limit ให้มากกว่า
app.use(express.json({ limit: '25mb' }));
app.use('/api/uploads', express.static(UPLOAD_DIR, { maxAge: '1y' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'Service desk API is running',
    health: '/api/health',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    const { count, error } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({ ok: true, message: 'Service desk API is healthy', requestCount: count });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database unavailable', error: String(error) });
  }
});

app.get('/api/requests', async (_req, res) => {
  try {
    const PAGE_SIZE = 1000;
    const all = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('requests')
        .select(REQUEST_COLUMNS.join(','))
        .order('receivedAt', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    res.json(all);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch requests', error: String(error) });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch request', error: String(error) });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const body = req.body || {};
    const { data, error } = await supabase
      .from('requests')
      .insert({
        customer: body.customer || '',
        ref: body.ref || null,
        source: body.source || null,
        receivedAt: body.receivedAt ? new Date(body.receivedAt).toISOString() : new Date().toISOString(),
        ticket: body.ticket || null,
        location: body.location || null,
        site: body.site || null,
        contact: body.contact || null,
        phone: body.phone || null,
        description: body.description || null,
        image: body.image || null,
        ma: body.ma || 'N',
        jobType: body.jobType || null,
        status: body.status || null,
        assignee: body.assignee || null,
        appointment: body.appointment ? new Date(body.appointment).toISOString() : null,
        appointmentEnd: body.appointmentEnd ? new Date(body.appointmentEnd).toISOString() : null,
        action: body.action || null,
        result: body.result || null,
        equipment: body.equipment || null,
        completedImage: body.completedImage || null,
        completedAt: body.completedAt ? new Date(body.completedAt).toISOString() : null,
        map: body.map || null,
        vehicle: body.vehicle || null,
        notes: body.notes || null,
        file: body.file || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create request', error: String(error) });
  }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const updates = {};
    const setIfDefined = (key, value) => {
      if (value !== undefined) updates[key] = value;
    };

    setIfDefined('customer', body.customer);
    setIfDefined('ref', body.ref);
    setIfDefined('source', body.source);
    setIfDefined('receivedAt', body.receivedAt ? new Date(body.receivedAt).toISOString() : undefined);
    setIfDefined('ticket', body.ticket);
    setIfDefined('location', body.location);
    setIfDefined('site', body.site);
    setIfDefined('contact', body.contact);
    setIfDefined('phone', body.phone);
    setIfDefined('description', body.description);
    setIfDefined('image', body.image);
    setIfDefined('ma', body.ma);
    setIfDefined('jobType', body.jobType);
    setIfDefined('status', body.status);
    setIfDefined('assignee', body.assignee);
    setIfDefined('appointment', body.appointment ? new Date(body.appointment).toISOString() : undefined);
    setIfDefined('appointmentEnd', body.appointmentEnd ? new Date(body.appointmentEnd).toISOString() : undefined);
    setIfDefined('action', body.action);
    setIfDefined('result', body.result);
    setIfDefined('equipment', body.equipment);
    setIfDefined('completedImage', body.completedImage);
    setIfDefined('completedAt', body.completedAt ? new Date(body.completedAt).toISOString() : undefined);
    setIfDefined('map', body.map);
    setIfDefined('vehicle', body.vehicle);
    setIfDefined('notes', body.notes);
    setIfDefined('file', body.file);

    const { data, error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update request', error: String(error) });
  }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('requests')
      .select('image, completedImage')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing?.image) {
      await removeImage('service-desk-images', existing.image);
    }
    if (existing?.completedImage) {
      await removeImage('service-desk-images', existing.completedImage);
    }

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete request', error: String(error) });
  }
});

app.post('/api/upload', async (req, res) => {
  try {
    const { file, fileName, bucket = 'service-desk-images' } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const buffer = Buffer.from(file, 'base64');

    if (!buffer.length) {
      return res.status(400).json({ message: 'File is empty or not valid base64' });
    }

    const publicUrl = await storeImage(bucket, buffer, fileName, `${req.protocol}://${req.get('host')}`);

    res.json({ url: publicUrl });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ message: 'Failed to upload image', error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`Service desk API listening on http://localhost:${PORT}`);
});
