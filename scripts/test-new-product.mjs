
import admin from 'firebase-admin';

const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!secret) throw new Error('Firebase Secret이 없습니다.');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(secret))
});

const db = admin.firestore();

const productId = 'swimdrop_test_001';
const productRef = db.collection('testProducts').doc(productId);
const eventRef = db.collection('testEvents').doc(productId);

const existing = await productRef.get();

if (existing.exists) {
  console.log('이미 등록된 테스트 상품입니다.');
} else {
  await productRef.create({
    brand: '졸린',
    title: 'SWIM DROP 신규 상품 감지 테스트',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await eventRef.create({
    brand: '졸린',
    type: '신상 예고',
    title: 'SWIM DROP 신규 상품 감지 테스트',
    enabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('신규 상품 감지 성공!');
  console.log('테스트 알림 이벤트 생성 성공!');
}

console.log('SWIM DROP 테스트 완료');
