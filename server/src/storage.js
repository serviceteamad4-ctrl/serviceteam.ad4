import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { uploadImageToStorage, deleteImageFromStorage } from './supabase.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = path.resolve(currentDir, '../data/uploads');
export const LOCAL_URL_PREFIX = '/api/uploads/';

const CONTENT_TYPE_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
};

const extensionOf = (fileName) => {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPE_BY_EXTENSION[ext] ? ext : 'jpg';
};

// ชื่อไฟล์ไทย/เว้นวรรค/อักขระพิเศษ ทำให้ storage key ใช้ไม่ได้ จึงสร้างชื่อใหม่เสมอ
const safeFileName = (fileName) => {
  const ext = extensionOf(fileName);
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
};

const publicBase = () => (process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');

const saveLocally = (buffer, key) => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
  return `${publicBase()}${LOCAL_URL_PREFIX}${key}`;
};

export const storeImage = async (bucket, buffer, originalName) => {
  if (!buffer?.length) return null;

  const key = safeFileName(originalName);
  const contentType = CONTENT_TYPE_BY_EXTENSION[extensionOf(originalName)];

  try {
    return await uploadImageToStorage(bucket, buffer, key, contentType);
  } catch (error) {
    console.warn(
      `Supabase storage unavailable (${error?.message || error}) - saving image to local disk instead`,
    );
    return saveLocally(buffer, key);
  }
};

export const removeImage = async (bucket, url) => {
  if (!url) return;

  const localIndex = url.indexOf(LOCAL_URL_PREFIX);
  if (localIndex === -1) {
    await deleteImageFromStorage(bucket, url);
    return;
  }

  const key = path.basename(url.slice(localIndex + LOCAL_URL_PREFIX.length));
  try {
    fs.rmSync(path.join(UPLOAD_DIR, key), { force: true });
  } catch (error) {
    console.error('Local image deletion error:', error);
  }
};
