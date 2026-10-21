
const url = 'https://jolyn.com/products.json?limit=5';

console.log('🏊 SWIM DROP 졸린 상품 수집 시작');

try {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP 오류: ${response.status}`);
  }

  const data = await response.json();
  const products = data.products || [];

  console.log('수집 상품 수:', products.length);

  for (const product of products) {
    const price = product.variants?.[0]?.price || '미확인';

    const available = product.variants?.some(
      variant => variant.available
    ) ?? false;

    console.log('-----------------------');
    console.log('상품명:', product.title);
    console.log('가격(USD):', price);
    console.log('판매 가능:', available);
    console.log('상품 링크:',
      `https://jolyn.com/products/${product.handle}`
    );
    console.log('등록일:', product.created_at);
  }

} catch (error) {
  console.error('상품 수집 실패:', error.message);
  process.exitCode = 1;
}
