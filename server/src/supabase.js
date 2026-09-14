import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials are not configured');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadImageToStorage = async (bucket, file, fileName, contentType) => {
  if (!file) return null;

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType || 'application/octet-stream',
      });

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
};

export const deleteImageFromStorage = async (bucket, filePath) => {
  if (!filePath) return;

  try {
    const fileName = filePath.split('/').pop();
    await supabase.storage
      .from(bucket)
      .remove([fileName]);
  } catch (error) {
    console.error('Image deletion error:', error);
  }
};
