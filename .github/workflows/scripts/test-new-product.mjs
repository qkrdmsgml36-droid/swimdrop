
import admin from 'firebase-admin';

const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!secret) throw new Error('Firebase Secret이 없습니다.');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(secret))
});

const db = admin.firestore();

// 실제 상품이나 알림에 영향을 주지 않는 테스트 데이터
const product = {
  id: 'swimdrop_test_001',
  brand: '졸린',
  title: 'SWIM DROP 신규 상품 감지 테스트'
};

const productRef = db.collection('testProducts').doc(product.id);
const eventRef = db.collection('testEvents').doc(product.id);

const existing = await productRef.get();

if (existing.exists) {
  console.log('이미 등록된 테스트 상품입니다.');
} else {
  await productRef.create({
    ...product,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await eventRef.create({
    brand: product.brand,
    type: '신상 예고',
    title: product.title,
    enabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('신규 상품 감지 성공!');
  console.log('테스트 알림 이벤트 생성 성공!');
}

console.log('SWIM DROP 테스트 완료');
