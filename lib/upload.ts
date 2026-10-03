import { File } from 'expo-file-system';
import { supabase } from './supabase';

const BUCKET = 'item-images';

function contentTypeFor(uri: string): string {
  const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Upload a locally-picked image to Supabase Storage and return its public URL.
 * Returns null on failure so callers can fall back to the local URI.
 */
export async function uploadItemImage(
  uri: string,
  houseId: string,
  itemId: string,
): Promise<string | null> {
  try {
    const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
    const path = `${houseId}/${itemId}.${ext}`;
    const bytes = await new File(uri).arrayBuffer();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { upsert: true, contentType: contentTypeFor(uri) });

    if (error) {
      console.error('[upload] item image:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('[upload] item image failed:', e);
    return null;
  }
}
