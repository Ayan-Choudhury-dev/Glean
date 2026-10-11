import { categorize, type HouseCategory } from './categorize';

export type ProductLookup = {
  barcode: string;
  name: string;
  brand?: string;
  category: HouseCategory;
  imageUrl?: string;
  source: 'openfoodfacts' | 'upcitemdb';
};

const OFF = 'https://world.openfoodfacts.org/api/v2/product';
const UPC = 'https://api.upcitemdb.com/prod/trial/lookup';

const TIMEOUT_MS = 6000;

async function getJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Look a barcode up in the free, key-less product databases.
 *
 * OpenFoodFacts covers packaged food (the bulk of a grocery inventory);
 * UPCitemdb's trial endpoint is the fallback for everything else. Both are
 * best-effort — a miss returns null and the caller should let the user name it.
 */
export async function lookupProduct(barcode: string): Promise<ProductLookup | null> {
  const code = barcode.trim();
  if (!code) return null;

  const off = await getJson(`${OFF}/${encodeURIComponent(code)}.json`);
  const p = off?.product;
  if (p && (p.product_name || p.generic_name)) {
    const name = titleCase(p.product_name || p.generic_name);
    const brand = p.brands ? String(p.brands).split(',')[0].trim() : undefined;
    return {
      barcode: code,
      name,
      brand,
      category: categorize({ name, brand, categories: p.categories }),
      imageUrl: p.image_front_small_url || p.image_url || undefined,
      source: 'openfoodfacts',
    };
  }

  const upc = await getJson(`${UPC}?upc=${encodeURIComponent(code)}`);
  const item = upc?.items?.[0];
  if (item?.title) {
    const name = titleCase(item.title);
    const brand = item.brand ? String(item.brand) : undefined;
    return {
      barcode: code,
      name,
      brand,
      category: categorize({ name, brand, categories: item.category }),
      imageUrl: item.images?.[0] || undefined,
      source: 'upcitemdb',
    };
  }

  return null;
}
