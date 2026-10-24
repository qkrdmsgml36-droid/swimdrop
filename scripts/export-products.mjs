
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://jolyn.com';
const products = new Map();

for (let page = 1; page <= 40; page++) {
  const response = await fetch(
    `${BASE}/products.json?limit=250&page=${page}`,
    { signal: AbortSignal.timeout(30000) }
  );

  if (!response.ok) {
    throw new Error(`상품 조회 실패: ${response.status}`);
  }

  const data = await response.json();
  const list = data.products || [];

  for (const p of list) {
    if (p.id && p.handle) {
      products.set(String(p.id), p);
    }
  }

  if (list.length < 250) break;
}

const items = [...products.values()]
  .sort((a, b) =>
    new Date(b.created_at || 0) -
    new Date(a.created_at || 0)
  )
  .slice(0, 60)
  .map(p => ({
    id: String(p.id),
    brand: '졸린',
    name: p.title,
    image: p.images?.[0]?.src || '',
    price: p.variants?.[0]?.price || '',
    currency: 'USD',
    available: p.variants?.some(v => v.available) ?? false,
    url: `${BASE}/products/${p.handle}`,
    createdAt: p.created_at || null
  }));

await mkdir('data', { recursive: true });

await writeFile(
  'data/products.json',
  JSON.stringify({
    updatedAt: new Date().toISOString(),
    products: items
  }, null, 2),
  'utf8'
);

console.log(`홈페이지용 상품 데이터 ${items.length}개 생성 완료`);
