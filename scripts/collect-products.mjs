
import admin from 'firebase-admin';

const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!secret) throw new Error('Firebase 비밀키가 없습니다.');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(secret))
});

const db = admin.firestore();

const BASE = 'https://jolyn.com';
const LIMIT = 250;
const MAX_PAGES = 40;
const brand = '졸린';

console.log('🏊 SWIM DROP 신상품 자동 감지 시작');

let total = 0;
let added = 0;
let existing = 0;
let completed = false;

const products = new Map();

// 1. 공식몰 상품 목록 전체 수집
for (let page = 1; page <= MAX_PAGES; page++) {
  const response = await fetch(
    `${BASE}/products.json?limit=${LIMIT}&page=${page}`,
    { signal: AbortSignal.timeout(30000) }
  );

  if (!response.ok) {
    throw new Error(`페이지 ${page} 오류: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.products)) {
    throw new Error('상품 데이터 형식 오류');
  }

  console.log(`페이지 ${page}: ${data.products.length}개`);

  if (data.products.length === 0) {
    completed = true;
    break;
  }

  for (const product of data.products) {
    if (product.id && product.handle) {
      products.set(String(product.id), product);
    }
  }

  if (data.products.length < LIMIT) {
    completed = true;
    break;
  }
}

if (!completed) {
  throw new Error('전체 상품 수집이 완료되지 않았습니다.');
}

total = products.size;
console.log('전체 고유 상품:', total);

// 2. 초기 등록 완료 상태 확인
const stateRef = db.collection('collectorState').doc('jolyn');
const stateSnap = await stateRef.get();

// 이전에 상품을 수집했으므로 첫 실행은
// 기존 상품 확인 및 기준선 설정용으로 사용
const baselineMode = !stateSnap.exists;

const writer = db.bulkWriter();

writer.onWriteError(error => {
  if (error.code === 6) return false;
  return error.failedAttempts < 3;
});

const tasks = [];

for (const product of products.values()) {
  const ref = db.collection('products')
    .doc(`jolyn_${product.id}`);

  const productData = {
    brand,
    source: 'jolyn.com',
    productId: String(product.id),
    title: product.title || '',
    url: `${BASE}/products/${product.handle}`,
    price: product.variants?.[0]?.price || null,
    available: product.variants?.some(
      variant => variant.available
    ) ?? false,
    createdAt: product.created_at || null,
    firstSeenAt:
      admin.firestore.FieldValue.serverTimestamp()
  };

  tasks.push(
    writer.create(ref, productData)
      .then(async () => {
        added++;

        if (baselineMode) return;

        // 새 상품에 대한 알림 이벤트 생성
        const eventRef = db.collection('events')
          .doc(`jolyn_new_${product.id}`);

        await eventRef.create({
          brand,
          type: '신상 예고',
          title: `🏊 졸린 신상품: ${product.title}`,
          body: 'SWIM DROP에서 신상품을 확인하세요!',
          url: productData.url,
          enabled: true,
          createdAt:
            admin.firestore.FieldValue.serverTimestamp()
        });
      })
      .catch(error => {
        if (error.code === 6 ||
            error.code === 'already-exists') {
          existing++;
          return;
        }
        throw error;
      })
  );
}

await writer.close();

const results = await Promise.allSettled(tasks);
const failures = results.filter(r => r.status === 'rejected');

if (failures.length) {
  console.error('처리 실패:', failures.length);
  throw new Error('상품 저장에 실패했습니다.');
}

// 3. 최초 기준선 설정
if (baselineMode) {
  await stateRef.create({
    initialized: true,
    initializedAt:
      admin.firestore.FieldValue.serverTimestamp(),
    baselineCount: total
  });
}

console.log('-----------------------');
console.log('전체 상품:', total);
console.log('신규 저장:', added);
console.log('기존 상품:', existing);
console.log('기준선 모드:', baselineMode);
console.log('알림 이벤트:',
  baselineMode ? 0 : added
);
console.log('SWIM DROP 수집 완료');
