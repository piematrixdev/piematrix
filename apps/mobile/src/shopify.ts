/**
 * Shared Shopify API — fetches products from thepiematrix.com public JSON API.
 */

export const SHOP_URL = 'https://thepiematrix.com';

export interface Product {
  id: string;
  title: string;
  handle: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  image: string | null;
  images: string[];
  available: boolean;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  variants: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  available: boolean;
}

export interface Collection {
  title: string;
  handle: string;
  products: Product[];
}

function mapProduct(p: any): Product {
  return {
    id: String(p.id),
    title: p.title ?? '',
    handle: p.handle ?? '',
    price: p.variants?.[0]?.price ?? '0',
    compareAtPrice: p.variants?.[0]?.compare_at_price ?? null,
    currency: 'INR',
    image: p.images?.[0]?.src ?? null,
    images: (p.images ?? []).map((img: any) => img.src),
    available: p.variants?.some((v: any) => v.available) ?? true,
    description: p.body_html ?? '',
    vendor: p.vendor ?? '',
    type: p.product_type ?? '',
    tags: typeof p.tags === 'string' ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (p.tags ?? []),
    variants: (p.variants ?? []).map((v: any) => ({
      id: String(v.id),
      title: v.title ?? 'Default',
      price: v.price ?? '0',
      compareAtPrice: v.compare_at_price ?? null,
      available: v.available ?? true,
    })),
  };
}

/**
 * Fetch products from a specific collection.
 */
export async function fetchCollectionProducts(handle: string, limit = 10): Promise<Product[]> {
  try {
    const res = await fetch(`${SHOP_URL}/collections/${handle}/products.json?limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.products ?? []).map(mapProduct);
  } catch (e) {
    console.warn('[Shopify] Fetch failed:', handle, e);
    return [];
  }
}

/**
 * Fetch a single product by handle.
 */
export async function fetchProduct(handle: string): Promise<Product | null> {
  try {
    const res = await fetch(`${SHOP_URL}/products/${handle}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.product ? mapProduct(json.product) : null;
  } catch (e) {
    console.warn('[Shopify] Product fetch failed:', handle, e);
    return null;
  }
}

/**
 * Fetch featured/popular products (from telescopes collection).
 */
export async function fetchFeaturedProducts(limit = 5): Promise<Product[]> {
  return fetchCollectionProducts('telescopes', limit);
}

/**
 * Fetch multiple collections.
 */
export async function fetchCollections(handles: string[]): Promise<Collection[]> {
  const collections: Collection[] = [];
  for (const handle of handles) {
    const products = await fetchCollectionProducts(handle, 10);
    if (products.length > 0) {
      const title = handle.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      collections.push({ title, handle, products });
    }
  }
  return collections;
}
