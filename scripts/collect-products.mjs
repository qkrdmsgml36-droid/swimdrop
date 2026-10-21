
const url = 'https://jolyn.com/collections/new-arrivals';

console.log('SWIM DROP 신상품 수집 테스트 시작');

try {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SWIMDROP-ProductMonitor/1.0' },
    signal: AbortSignal.timeout(15000)
  });

  console.log('HTTP 상태:', response.status);
  if (!response.ok) throw new Error('상품 페이지 접근 실패');

  const html = await response.text();
  console.log('페이지 크기:', html.length, '글자');
  console.log('상품 링크 발견:', (html.match(/\/products\//g) || []).length, '개');
  
const productLinks = [
  ...html.matchAll(/href=["']([^"']*\/products\/[^"'?#]+)[^"']*["']/g)
].map(match => match[1]);

const uniqueLinks = [...new Set(productLinks)];

console.log('고유 상품 링크:', uniqueLinks.length, '개');
console.log('상품 링크 샘플:', uniqueLinks.slice(0, 5));

const checks = {
  shopifyProducts: html.includes('products.json'),
  jsonLd: html.includes('application/ld+json'),
  nextData: html.includes('__NEXT_DATA__'),
  productSchema: html.includes('"@type":"Product"'),
  productWord: html.includes('상품명')
};

console.log('상품 데이터 구조 검사:', checks);

const jsonLdBlocks = [
  ...html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
];

console.log('JSON-LD 블록 수:', jsonLdBlocks.length);

for (const [index, match] of jsonLdBlocks.entries()) {
  try {
    const data = JSON.parse(match[1]);
    const items = Array.isArray(data) ? data : [data];

    console.log(
      `JSON-LD ${index + 1} 유형:`,
      items.map(item => item['@type'] || '유형 없음')
    );
  } catch {
    console.log(`JSON-LD ${index + 1}: 파싱 실패`);
  }
}

} catch (error) {
  console.error('수집 테스트 실패:', error.message);
  process.exitCode = 1;
}
  
