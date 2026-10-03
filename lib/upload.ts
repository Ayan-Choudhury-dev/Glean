import { File } from 'expo-file-system';
import { supabase } from './supabase';

const BUCKET = 'item-images';
const AVATAR_BUCKET = 'avatars';

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

/** Upload a locally-picked avatar and return its public URL (null on failure). */
export async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
    const path = `avatars/${userId}.${ext}`;
    const bytes = await new File(uri).arrayBuffer();

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: contentTypeFor(uri) });

    if (error) {
      console.error('[upload] avatar:', error.message);
      return null;
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('[upload] avatar failed:', e);
    return null;
  }
}

/** Remove an item's stored image(s) when the item is deleted. */
export async function deleteItemImage(houseId: string, itemId: string): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(houseId, { search: itemId });

    if (error) {
      console.error('[upload] list for delete:', error.message);
      return;
    }

    const paths = (data ?? [])
      .filter(entry => entry.name.startsWith(`${itemId}.`))
      .map(entry => `${houseId}/${entry.name}`);

    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch (e) {
    console.error('[upload] delete item image failed:', e);
  }
}
