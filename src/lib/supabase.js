import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are not configured');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadImage = async (bucket, file, fileName) => {
  if (!file) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
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

export const deleteImage = async (bucket, filePath) => {
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
