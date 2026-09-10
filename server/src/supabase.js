import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials are not configured');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadImageToStorage = async (bucket, file, fileName) => {
  if (!file) return null;

  try {
    // Check if bucket exists, if not create it
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucket);

    if (!bucketExists) {
      console.log(`Creating bucket: ${bucket}`);
      await supabase.storage.createBucket(bucket, {
        public: true,
      });
    }

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
