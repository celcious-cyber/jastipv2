// sw.js - Service Worker untuk Offline-First PWA Jastip Studio
const CACHE_NAME = 'jastip-pwa-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/supabase-config.js',
  '/inventory.js',
  '/orders.js',
  '/customers.js',
  '/staff.js',
  '/settings.js',
  '/reports.js',
  '/live-events.js',
  '/live-session.js',
  '/live-capture.js',
  '/live.js',
  '/add-customer.js',
  '/add-inventory.js',
  '/add-order.js',
  '/add_staff.js',
  '/edit-order.js',
  '/jastip-icon-512.svg',
  '/jastip-icon-512.png',
  '/manifest.json',
  '/pages/inventory.html',
  '/pages/orders.html',
  '/pages/customers.html',
  '/pages/staff.html',
  '/pages/settings.html',
  '/pages/reports.html',
  '/pages/live-events.html',
  '/pages/live-session.html',
  '/pages/live-capture.html',
  '/pages/live.html',
  '/pages/add-customer.html',
  '/pages/add-inventory.html',
  '/pages/add-order.html',
  '/pages/add-staff.html',
  '/pages/edit-order.html',
  '/public/event.html',
  '/public/grab-success.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Resource di-cache untuk penggunaan offline!');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Hapus cache lama saat service worker baru diaktivasi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
