import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import { uploadImageToStorage, deleteImageFromStorage } from './supabase.js';

const app = express();
const PORT = Number(process.env.PORT || 4001);

app.use(cors({
  origin: (origin, callback) => {
    const isLocalFrontend = !origin
      || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isConfiguredFrontend = origin && origin === process.env.FRONTEND_URL;

    callback(null, isLocalFrontend || isConfiguredFrontend);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    message: 'Service desk API is running',
    health: '/api/health',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const { _count: requestCount } = await prisma.request.aggregate({ _count: true });
    res.json({ ok: true, message: 'Service desk API is healthy', requestCount });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database unavailable', error: String(error) });
  }
});

app.get('/api/requests', async (_req, res) => {
  try {
    const requests = await prisma.request.findMany({
      select: {
        id: true,
        customer: true,
        ref: true,
        source: true,
        receivedAt: true,
        ticket: true,
        location: true,
        site: true,
        contact: true,
        phone: true,
        description: true,
        image: true,
        ma: true,
        jobType: true,
        status: true,
        assignee: true,
        appointment: true,
        appointmentEnd: true,
        action: true,
        result: true,
        equipment: true,
        completedImage: true,
        completedAt: true,
        map: true,
        vehicle: true,
        notes: true,
        file: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { receivedAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch requests', error: String(error) });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch request', error: String(error) });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const body = req.body || {};
    const request = await prisma.request.create({
      data: {
        customer: body.customer || '',
        ref: body.ref || null,
        source: body.source || null,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
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
        appointment: body.appointment ? new Date(body.appointment) : null,
        appointmentEnd: body.appointmentEnd ? new Date(body.appointmentEnd) : null,
        action: body.action || null,
        result: body.result || null,
        equipment: body.equipment || null,
        completedImage: body.completedImage || null,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        map: body.map || null,
        vehicle: body.vehicle || null,
        notes: body.notes || null,
        file: body.file || null,
      },
    });

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create request', error: String(error) });
  }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const request = await prisma.request.update({
      where: { id: req.params.id },
      data: {
        customer: body.customer,
        ref: body.ref,
        source: body.source,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
        ticket: body.ticket,
        location: body.location,
        site: body.site,
        contact: body.contact,
        phone: body.phone,
        description: body.description,
        image: body.image,
        ma: body.ma,
        jobType: body.jobType,
        status: body.status,
        assignee: body.assignee,
        appointment: body.appointment ? new Date(body.appointment) : undefined,
        appointmentEnd: body.appointmentEnd ? new Date(body.appointmentEnd) : undefined,
        action: body.action,
        result: body.result,
        equipment: body.equipment,
        completedImage: body.completedImage,
        completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
        map: body.map,
        vehicle: body.vehicle,
        notes: body.notes,
        file: body.file,
      },
    });

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update request', error: String(error) });
  }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      select: { image: true, completedImage: true },
    });

    if (request?.image) {
      await deleteImageFromStorage('service-desk-images', request.image);
    }
    if (request?.completedImage) {
      await deleteImageFromStorage('service-desk-images', request.completedImage);
    }

    await prisma.request.delete({ where: { id: req.params.id } });
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
    const publicUrl = await uploadImageToStorage(bucket, buffer, fileName);

    res.json({ url: publicUrl });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload image', error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`Service desk API listening on http://localhost:${PORT}`);
});
