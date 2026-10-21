
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

let total = 0;
let saved = 0;
let existing = 0;
let completed = false;

const writer = db.bulkWriter();


writer.onWriteError(error => {
  if (
    error.code === 6 ||
    error.code === 'already-exists'
  ) {
    return false;
  }

  console.error('저장 오류:', error.message);

  return error.failedAttempts < 3;
});


const pending = [];

console.log('🏊 SWIM DROP 빠른 전체 상품 수집 시작');

try {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${BASE}/products.json?limit=${LIMIT}&page=${page}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(
        `페이지 ${page} HTTP 오류: ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data.products)) {
      throw new Error('상품 데이터 형식 오류');
    }

    const products = data.products;
    console.log(`페이지 ${page}: ${products.length}개`);

    if (products.length === 0) {
      completed = true;
      break;
    }

    total += products.length;

    for (const product of products) {
      if (!product.id || !product.handle) continue;

      const ref = db.collection('products')
        .doc(`jolyn_${product.id}`);

      const productData = {
        brand: '졸린',
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

      pending.push(
        writer.create(ref, productData)
          .then(() => { saved++; })
          .catch(error => {
            if (
              error.code === 6 ||
              error.code === 'already-exists'
            ) {
              existing++;
            } else {
              throw error;
            }
          })
      );
    }

    if (products.length < LIMIT) {
      completed = true;
      break;
    }
  }
} finally {
  await writer.close();
}

const results = await Promise.allSettled(pending);
const failed = results.filter(r => r.status === 'rejected');

console.log('-------------------------');
console.log('전체 수집 상품:', total);
console.log('Firebase 신규 저장:', saved);
console.log('이미 저장된 상품:', existing);
console.log('저장 실패:', failed.length);
console.log('전체 수집 종료 확인:', completed);
console.log('알림 발송: 0건');

if (failed.length > 0 || !completed) {
  process.exitCode = 1;
}
