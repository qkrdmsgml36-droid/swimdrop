
const url = 'https://jolyn.com/collections/new-arrivals';

console.log('SWIM DROP 신상품 수집 테스트 시작');

try {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SWIMDROP-ProductMonitor/1.0'
    },
    signal: AbortSignal.timeout(15000)
  });

  console.log('HTTP 상태:', response.status);

  if (!response.ok) {
    throw new Error('쇼핑몰 접근 실패');
  }

  const html = await response.text();

  console.log('페이지 크기:', html.length, '글자');

  const productLinks = [
    ...html.matchAll(
      /href=["']([^"']*\/products\/[^"'?#]+)[^"']*["']/g
    )
  ].map(match => match[1]);

  console.log(
    '고유 상품 링크:',
    new Set(productLinks).size
  );

  const nextData = html.match(
    /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  const flightChunks = [
    ...html.matchAll(/self\.__next_f\.push\(/g)
  ];

  console.log(
    'Next.js 데이터 블록:',
    nextData ? 1 : 0
  );

  console.log(
    'Next.js Flight 청크:',
    flightChunks.length
  );

  for (const keyword of [
    'productName',
    'productList',
    'products',
    'price',
    '재입고',
    '신상품'
  ]) {
    console.log(
      `키워드 ${keyword}:`,
      html.includes(keyword) ? '발견' : '없음'
    );
  }

} catch (error) {
  console.error('수집 테스트 실패:', error.message);
  process.exitCode = 1;
}
