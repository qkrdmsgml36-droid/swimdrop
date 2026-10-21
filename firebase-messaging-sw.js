/* GitHub Pages /swimdrop/ 경로에 놓고 해당 scope로 등록합니다. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
importScripts('./firebase-config.js');
firebase.initializeApp(self.SWIMDROP_FIREBASE_CONFIG);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || 'SWIM DROP 새 알림', {
    body: data.body || '새로운 수영복 소식이 있어요.',
    icon: './icon-192.png',
    tag: data.eventId || 'swimdrop',
    data: { url: data.url || './instagram.html' }
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './instagram.html', self.registration.scope);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(clients.openWindow(target.href));
});
