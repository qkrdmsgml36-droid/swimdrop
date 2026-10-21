
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
} catch (error) {
  console.error('수집 테스트 실패:', error.message);
  process.exitCode = 1;
}
  
