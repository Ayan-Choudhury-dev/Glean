import { Directory, File, Paths } from 'expo-file-system';

// Local-only: images are copied into the app's document directory and referenced
// by their local file URI. No server upload.

function imagesDir(): Directory {
  const dir = new Directory(Paths.document, 'item-images');
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch {
    /* already exists */
  }
  return dir;
}

function extOf(uri: string): string {
  return (uri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
}

async function copyInto(uri: string, name: string): Promise<string> {
  const dest = new File(imagesDir(), name);
  new File(uri).copy(dest);
  return dest.uri;
}

/** Copy a picked image into app storage and return its local URI. */
export async function uploadItemImage(uri: string, _houseId: string, itemId: string): Promise<string | null> {
  try {
    return await copyInto(uri, `${itemId}.${extOf(uri)}`);
  } catch (e) {
    console.error('[image] copy failed:', e);
    return uri;
  }
}

/** Copy a picked avatar into app storage and return its local URI. */
export async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    return await copyInto(uri, `avatar-${userId}.${extOf(uri)}`);
  } catch (e) {
    console.error('[image] avatar copy failed:', e);
    return uri;
  }
}

/** Remove an item's stored image(s) when the item is deleted. */
export async function deleteItemImage(_houseId: string, itemId: string): Promise<void> {
  try {
    const dir = imagesDir();
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith(`${itemId}.`)) {
        entry.delete();
      }
    }
  } catch (e) {
    console.error('[image] delete failed:', e);
  }
}
