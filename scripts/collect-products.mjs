
import admin from 'firebase-admin';

const secret = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!secret) {
  throw new Error('Firebase 비밀키가 없습니다.');
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(secret))
});

const db = admin.firestore();

const url = 'https://jolyn.com/products.json?limit=250';

console.log('🏊 SWIM DROP 졸린 상품 수집 시작');

const response = await fetch(url, {
  signal: AbortSignal.timeout(20000)
});

if (!response.ok) {
  throw new Error(`상품 수집 오류: ${response.status}`);
}

const data = await response.json();

if (!Array.isArray(data.products)) {
  throw new Error('상품 데이터 형식이 올바르지 않습니다.');
}

console.log('수집 상품 수:', data.products.length);

let saved = 0;
let existing = 0;

for (const product of data.products) {
  if (!product.id || !product.handle) continue;

  const docId = `jolyn_${product.id}`;
  const ref = db.collection('products').doc(docId);

  const snapshot = await ref.get();

  if (snapshot.exists) {
    existing++;
    continue;
  }

  const productData = {
    brand: '졸린',
    source: 'jolyn.com',
    productId: String(product.id),
    title: product.title || '',
    url: `https://jolyn.com/products/${product.handle}`,
    price: product.variants?.[0]?.price || null,
    available: product.variants?.some(
      variant => variant.available
    ) ?? false,
    createdAt: product.created_at || null,
    firstSeenAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await ref.create(productData);
  saved++;
}

console.log('Firebase 신규 저장:', saved, '건');
console.log('이미 저장된 상품:', existing, '건');
console.log('알림 발송: 0건 (초기 데이터 등록 단계)');
