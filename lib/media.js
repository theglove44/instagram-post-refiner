/**
 * Media storage utilities for Supabase Storage.
 * Handles upload, deletion, validation, and public URL generation
 * for the 'post-media' bucket.
 */

import { getSupabaseClient } from './supabase';

const BUCKET_NAME = 'post-media';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validate a media file before upload.
 * Returns { valid, error, mediaType } where mediaType is 'IMAGE' or 'VIDEO'.
 */
export function validateMediaFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided', mediaType: null };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      mediaType: null,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum: ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      mediaType: null,
    };
  }

  const mediaType = ALLOWED_VIDEO_TYPES.includes(file.type) ? 'VIDEO' : 'IMAGE';

  return { valid: true, error: null, mediaType };
}

/**
 * Generate a unique storage path for a file.
 */
function generateStoragePath(scheduledPostId, fileName) {
  const ext = fileName.split('.').pop() || 'jpg';
  const uuid = crypto.randomUUID();
  return `${scheduledPostId}/${uuid}.${ext}`;
}

/**
 * Upload a file to Supabase Storage.
 * Returns { storagePath, publicUrl }.
 */
export async function uploadToStorage(file, scheduledPostId) {
  const supabase = getSupabaseClient();
  const storagePath = generateStoragePath(scheduledPostId, file.name);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const publicUrl = getPublicUrl(storagePath);
  return { storagePath, publicUrl };
}

/**
 * Upload a Buffer/ArrayBuffer to Supabase Storage (for server-side uploads).
 * Returns { storagePath, publicUrl }.
 */
export async function uploadBufferToStorage(buffer, scheduledPostId, fileName, contentType) {
  const supabase = getSupabaseClient();
  const storagePath = generateStoragePath(scheduledPostId, fileName);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const publicUrl = getPublicUrl(storagePath);
  return { storagePath, publicUrl };
}

/**
 * Get the public URL for a storage path.
 */
export function getPublicUrl(storagePath) {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFromStorage(storagePath) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Delete all media files for a scheduled post.
 */
export async function deleteAllPostMedia(scheduledPostId) {
  const supabase = getSupabaseClient();

  // List all files in the post's folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`${scheduledPostId}`);

  if (listError) {
    throw new Error(`Failed to list files: ${listError.message}`);
  }

  if (!files || files.length === 0) return;

  const paths = files.map(f => `${scheduledPostId}/${f.name}`);
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (error) {
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}
