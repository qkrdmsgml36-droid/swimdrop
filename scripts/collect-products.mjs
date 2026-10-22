
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

const products = new Map();
let completed = false;

// 1. 공식몰 전체 상품 수집
for (let page = 1; page <= MAX_PAGES; page++) {
  const response = await fetch(
    `${BASE}/products.json?limit=${LIMIT}&page=${page}`,
    { signal: AbortSignal.timeout(30000) }
  );

  if (!response.ok) {
    throw new Error(
      `페이지 ${page} 오류: ${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.products)) {
    throw new Error('상품 데이터 형식 오류');
  }

  console.log(
    `페이지 ${page}: ${data.products.length}개`
  );

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
  throw new Error('전체 상품 수집 미완료');
}

// 2. 기존 기준선 확인
const stateRef = db.collection('collectorState').doc('jolyn');
const stateSnap = await stateRef.get();

if (!stateSnap.exists ||
    stateSnap.data().initialized !== true) {
  throw new Error(
    '기준선이 없습니다. 알림 오발송 방지를 위해 중단합니다.'
  );
}

let added = 0;
let existing = 0;
let eventsCreated = 0;

// 3. 기존 상품 조회 및 신규 상품 등록
const productList = [...products.values()];
const BATCH_SIZE = 100;

for (let i = 0; i < productList.length; i += BATCH_SIZE) {
  const batch = productList.slice(i, i + BATCH_SIZE);

  const refs = batch.map(product =>
    db.collection('products').doc(`jolyn_${product.id}`)
  );

  const snapshots = await db.getAll(...refs);

  for (let j = 0; j < batch.length; j++) {
    const product = batch[j];
    const snapshot = snapshots[j];

    if (snapshot.exists) {
      existing++;
      continue;
    }

    const productRef = refs[j];
    const eventRef = db.collection('events')
      .doc(`jolyn_new_${product.id}`);

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

    // 상품과 알림 이벤트를 함께 저장
    const result = await db.runTransaction(async tx => {
      const [currentProduct, currentEvent] =
        await Promise.all([
          tx.get(productRef),
          tx.get(eventRef)
        ]);

      if (currentProduct.exists) {
        return 'existing';
      }

      tx.create(productRef, productData);

      if (!currentEvent.exists) {
        tx.create(eventRef, {
          brand,
          type: '신상 예고',
          title: `🏊 졸린 신상품: ${product.title}`,
          body: 'SWIM DROP에서 신상품을 확인하세요!',
          url: productData.url,
          enabled: true,
          createdAt:
            admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return currentEvent.exists
        ? 'productOnly'
        : 'created';
    });

    if (result === 'existing') {
      existing++;
    } else {
      added++;

      if (result === 'created') {
        eventsCreated++;
      }
    }
  }
}

console.log('-----------------------');
console.log('전체 상품:', products.size);
console.log('신규 저장:', added);
console.log('기존 상품:', existing);
console.log('기준선 모드: false');
console.log('알림 이벤트:', eventsCreated);
console.log('SWIM DROP 수집 완료');
