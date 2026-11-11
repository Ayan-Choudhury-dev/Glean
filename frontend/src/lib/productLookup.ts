export interface ProductLookup {
  barcode: string
  name: string
  category: string
}

const OFF = 'https://world.openfoodfacts.org/api/v2/product'

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
}

/** Best-effort product lookup from Open Food Facts. Returns null on a miss. */
export async function lookupProduct(barcode: string): Promise<ProductLookup | null> {
  try {
    const res = await fetch(`${OFF}/${encodeURIComponent(barcode)}.json`)
    if (!res.ok) return null
    const data = (await res.json()) as { product?: { product_name?: string; generic_name?: string } }
    const name = data.product?.product_name || data.product?.generic_name
    if (!name) return null
    return { barcode, name: titleCase(name), category: 'Other' }
  } catch {
    return null
  }
}
