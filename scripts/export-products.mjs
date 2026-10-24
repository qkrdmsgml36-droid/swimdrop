
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://jolyn.com';
const products = new Map();

console.log('🏊 SWIM DROP 상품 이미지 수집 시작');

// 1. 공식몰 상품 목록 수집
let completed = false;

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

  console.log(`페이지 ${page}: ${list.length}개`);

  if (list.length < 250) {
    completed = true;
    break;
  }
}

if (!completed) {
  throw new Error('전체 상품 수집 미완료');
}

// 2. 최근 등록된 상품 60개
const selected = [...products.values()]
  .sort((a, b) =>
    new Date(b.created_at || 0) -
    new Date(a.created_at || 0)
  )
  .slice(0, 60);

// 3. 상품 이미지 찾기
async function getImage(product) {
  const direct =
    product.images?.[0]?.src ||
    product.image?.src ||
    product.featured_image?.src ||
    product.featured_image ||
    '';

  if (typeof direct === 'string' && direct) {
    return direct.startsWith('//')
      ? `https:${direct}`
      : direct;
  }

  // 목록에 이미지가 없으면 상품 상세 JSON 확인
  try {
    const response = await fetch(
      `${BASE}/products/${encodeURIComponent(product.handle)}.js`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) return '';

    const detail = await response.json();

    const image =
      detail.featured_image ||
      detail.images?.[0] ||
      '';

    if (typeof image === 'string') {
      return image.startsWith('//')
        ? `https:${image}`
        : image;
    }

    return image?.src || '';
  } catch (error) {
    console.log(`이미지 조회 실패: ${product.handle}`);
    return '';
  }
}

// 4. 이미지와 상품 정보 저장
const items = [];

for (const p of selected) {
  const image = await getImage(p);

  items.push({
    id: String(p.id),
    brand: '졸린',
    name: p.title,
    image,
    price: p.variants?.[0]?.price || '',
    currency: 'USD',
    available: p.variants?.some(v => v.available) ?? false,
    url: `${BASE}/products/${p.handle}`,
    createdAt: p.created_at || null
  });
}

await mkdir('data', { recursive: true });

await writeFile(
  'data/products.json',
  JSON.stringify({
    updatedAt: new Date().toISOString(),
    products: items
  }, null, 2),
  'utf8'
);

console.log('-----------------------');
console.log('전체 상품:', items.length);
console.log(
  '이미지 확보:',
  items.filter(p => p.image).length
);
console.log(
  '이미지 없음:',
  items.filter(p => !p.image).length
);
console.log('SWIM DROP 상품 데이터 생성 완료');

