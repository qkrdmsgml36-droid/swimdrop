
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://jolyn.com';
const products = new Map();

console.log('🏊 SWIM DROP 상품 이미지 수집 시작');

// 1. 공식몰 상품 목록 수집
let completed = false;

for (let page = 1; page <= 40; page++) {
  
let response;

for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    response = await fetch(
      `${BASE}/products.json?limit=250&page=${page}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (response.ok) break;

    console.log(
      `페이지 ${page} 조회 실패: HTTP ${response.status}, 시도 ${attempt}/4`
    );

    if (![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`상품 조회 실패: ${response.status}`);
    }
  } catch (error) {
    if (attempt === 4) throw error;
    console.log(`네트워크 오류: ${error.message}`);
  }

  if (attempt === 4) {
    throw new Error(`페이지 ${page} 조회 최종 실패`);
  }

  await new Promise(resolve =>
    setTimeout(resolve, attempt * 5000)
  );
}

if (!response?.ok) {
  throw new Error(`페이지 ${page} 조회 실패`);
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

function normalizeImage(value) {
  if (typeof value === 'object' && value !== null) {
    value = value.src || value.url || '';
  }

  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const url = value.trim().replaceAll('&amp;', '&');
  
if (
  /jolyn-logo|logo-black|placeholder|no-image/i.test(url)
) {
  return '';
}

  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${BASE}${url}`;
  if (url.startsWith('https://')) return url;

  return '';
}

function extractProductImage(html) {
  // Shopify 상품 페이지의 구조화된 데이터에서
  // 상품 이미지 주소 추출
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  function findProductImage(data) {
    if (!data || typeof data !== 'object') return '';

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = findProductImage(item);
        if (found) return found;
      }
      return '';
    }

    const type = data['@type'];
    const isProduct = Array.isArray(type)
      ? type.includes('Product')
      : type === 'Product';

    if (isProduct) {
      const images = Array.isArray(data.image)
        ? data.image
        : [data.image];

      for (const image of images) {
        const url = normalizeImage(image);
        if (url) return url;
      }
    }

    return findProductImage(data['@graph']);
  }

  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      const image = findProductImage(data);
      if (image) return image;
    } catch {
      // 구조화된 데이터가 유효하지 않으면 다음 항목 확인
    }
  }

  return '';
}

const productImage = extractProductImage(html);
if (productImage) return productImage;

async function getImage(product) {
  const candidates = [
    product.images?.[0],
    product.image,
    product.featured_image,
    product.variants?.[0]?.featured_image
  ];

  for (const candidate of candidates) {
    const url = normalizeImage(candidate);
    if (url) return url;
  }

  // 상품 상세 JSON 확인
  try {
    const response = await fetch(
      `${BASE}/products/${encodeURIComponent(product.handle)}.js`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (response.ok) {
      const detail = await response.json();

      const candidates = [
        detail.featured_image,
        detail.images?.[0],
        detail.variants?.[0]?.featured_image
      ];

      for (const candidate of candidates) {
        const url = normalizeImage(candidate);
        if (url) return url;
      }
    } else {
      console.log(`상세 JSON 응답: ${response.status} / ${product.handle}`);
    }
  } catch (error) {
    console.log(`상세 JSON 오류: ${product.handle} / ${error.message}`);
  }

  // 마지막으로 공식 상품 페이지의 대표 이미지 확인
  try {
    const response = await fetch(
      `${BASE}/products/${encodeURIComponent(product.handle)}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      console.log(`상품 페이지 응답: ${response.status} / ${product.handle}`);
      return '';
    }

    const html = await response.text();
    const productImage = extractProductImage(html);
if (productImage) return productImage; 
    const match = html.match(
      /<meta\b[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ) || html.match(
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["'][^>]*>/i
    );

    return normalizeImage(match?.[1] || '');
  } catch (error) {
    console.log(`상품 페이지 오류: ${product.handle} / ${error.message}`);
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

