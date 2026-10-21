
import admin from 'firebase-admin';

const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!secret) throw new Error('Firebase Secret이 없습니다.');

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(secret))
});

const db = admin.firestore();
const messaging = admin.messaging();

const events = await db.collection('events')
  .where('enabled', '==', true).get();

const subscribers = await db.collection('subscribers').get();

let sent = 0;

for (const eventDoc of events.docs) {
  const event = eventDoc.data();
  const type = event.type;

  if (!['신상 예고', '판매 시작', '재입고'].includes(type)) {
    continue;
  }

  for (const subscriberDoc of subscribers.docs) {
    const sub = subscriberDoc.data();

    if (sub.enabled === false || !sub.token) continue;
    if (!sub.brands?.includes(event.brand)) continue;
    if (!sub.types?.includes(type)) continue;

    const deliveryId = `${eventDoc.id}_${subscriberDoc.id}`;
    const ref = db.collection('pushDeliveries').doc(deliveryId);

    try {
      await db.runTransaction(async tx => {
        const existing = await tx.get(ref);
        if (existing.exists) throw new Error('DUPLICATE');

        tx.create(ref, {
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    } catch (error) {
      if (error.message === 'DUPLICATE') continue;
      throw error;
    }

    try {
      await messaging.send({
        token: sub.token,
        notification: {
          title: event.title || `${event.brand} ${type}`,
          body: event.body || '새로운 소식을 확인하세요.'
        },
        webpush: {
          fcmOptions: {
            link: event.url ||
              'https://qkrdmsgml36-droid.github.io/swimdrop/'
          }
        }
      });

      await ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      sent++;
    } catch (error) {
      await ref.update({
        status: 'failed',
        error: String(error.message).slice(0, 300)
      });
      console.error('발송 오류:', error.message);
    }
  }
}

console.log(`SWIM DROP 발송 완료: ${sent}건`);
