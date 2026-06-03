/**
 * uploadImage — uploads a File to the `app_media` Supabase Storage
 * bucket and returns its public URL.
 *
 * Writes are restricted to admins by the bucket's RLS policies
 * (see supabase/admin-media-bucket.sql).
 */

import { supabase } from '../lib/supabase';

const BUCKET = 'app_media';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export interface UploadResult {
  url: string;
  path: string;
}

/** Slugify a filename so storage keys stay clean and unique. */
function safeName(file: File, folder: string): string {
  const dot = file.name.lastIndexOf('.');
  const ext = (dot >= 0 ? file.name.slice(dot + 1) : 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${folder}/${Date.now()}-${rand}.${ext || 'jpg'}`;
}

export async function uploadImage(file: File, folder: string): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image is too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
  }

  const path = safeName(file, folder);

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    // Surface the most common failure (missing bucket / not admin) clearly.
    throw new Error(error.message || 'Upload failed.');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
