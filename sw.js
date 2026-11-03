/* دوائي — Service Worker
   - الصفحة والملفات الثابتة: تُخزَّن للتشغيل السريع وتعمل عند ضعف الاتصال.
   - بيانات Firestore / Auth: دائمًا من الشبكة (لا تُخزَّن) حتى لا تظهر معلومات توفر قديمة. */
const VERSION = 'dawai-v1.6.2';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// مصادر ثابتة نخزّنها (مكتبات + خطوط)
const CACHEABLE_HOSTS = [
  'cdn.jsdelivr.net',
  'www.gstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];
// مصادر لا تُخزَّن أبدًا (بيانات حيّة)
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebase.googleapis.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (NEVER_CACHE_HOSTS.includes(url.hostname)) return; // الشبكة مباشرة

  // التنقل بين الصفحات: الشبكة أولًا، ثم النسخة المخزنة عند انقطاع الاتصال
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // ملفات الموقع نفسه + مكتبات CDN + الخطوط: المخزَّن أولًا مع تحديث بالخلفية
  if (url.origin === location.origin || CACHEABLE_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
              const copy = res.clone();
              caches.open(RUNTIME).then(c => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
