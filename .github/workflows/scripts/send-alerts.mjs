
import admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT GitHub Secret이 없습니다.');
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount))
});

const db = admin.firestore();
const messaging = admin.messaging();
const now = Date.now();

const BRAND_NAMES = [
  '나이키', '졸린', '제이드', '키로우', '풀타임',
  '르망고', '펑키타', '펑키트렁크', '아레나',
  '스피도', '센티'
];

function notificationFor(event) {
  const brand = String(event.brand || '');
  const type = String(event.type || '');
  const title = String(event.title || `${brand} ${type}`);
  const launchTime = event.launchAt
    ? Date.parse(event.launchAt)
    : NaN;

  if (!BRAND_NAMES.includes(brand)) return null;

  if (
    event.enabled !== false &&
    ['신상 예고', '판매 시작', '재입고'].includes(type)
  ) {
    return {
      key: 'main',
      title,
      body: String(event.body || `${brand}의 새로운 소식을 확인하세요.`),
      type,
      reminder: false
    };
  }

  return null;
}

async function sendToSubscribers(event, notice) {
  const subscribers = await db.collection('subscribers').get();
  let sent = 0;

  for (const doc of subscribers.docs) {
    const sub = doc.data();

    if (sub.enabled === false || !sub.token) continue;
    if (!Array.isArray(sub.brands) ||
        !sub.brands.includes(event.brand)) continue;

    if (!Array.isArray(sub.types) ||
        !sub.types.includes(notice.type)) continue;

    const deliveryId = `${event.id}_${notice.key}_${doc.id}`;
    const deliveryRef = db.collection('pushDeliveries').doc(deliveryId);

    try {
      await db.runTransaction(async transaction => {
        const previous = await transaction.get(deliveryRef);
        if (previous.exists) throw new Error('ALREADY_SENT');
        transaction.create(deliveryRef, {
          eventId: event.id,
          subscriberId: doc.id,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (error) {
      if (error.message === 'ALREADY_SENT') continue;
      throw error;
    }

    try {
      await messaging.send({
        token: sub.token,
        notification: {
          title: notice.title,
          body: notice.body
        },
        webpush: {
          fcmOptions: {
            link: event.url || 'https://qkrdmsgml36-droid.github.io/swimdrop/'
          }
        }
      });

      await deliveryRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      sent++;
    } catch (error) {
      await deliveryRef.update({
        status: 'failed',
        error: String(error.message).slice(0, 300)
      });
      console.error('발송 실패:', error.message);
    }
  }

  return sent;
}

const events = await db.collection('events')
  .where('enabled', '==', true)
  .get();

let total = 0;

for (const doc of events.docs) {
  const event = { id: doc.id, ...doc.data() };
  const notice = notificationFor(event);

  if (!notice) continue;

  const count = await sendToSubscribers(event, notice);
  total += count;
  console.log(`${event.brand}: ${count}건 발송`);
}

console.log(`SWIM DROP 발송 완료: 총 ${total}건`);
