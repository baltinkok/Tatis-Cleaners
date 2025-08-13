const CACHE_NAME = 'tatis-cleaners-v1.0.1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('Service Worker: Install failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(function() {
      console.log('Service Worker: Activated successfully');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', function(event) {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls for caching (let them fail gracefully)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // Otherwise, fetch from network
        return fetch(event.request).then(function(response) {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response as it's a stream
          var responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      }
    )
  );
});

// Background sync for offline bookings (future enhancement)
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync-booking') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(
      // Here you could implement offline booking queue
      Promise.resolve()
    );
  }
});

// Push notifications (future enhancement)
self.addEventListener('push', function(event) {
  console.log('Service Worker: Push message received');
  
  const options = {
    body: event.data ? event.data.text() : 'Your cleaning service booking is confirmed!',
    icon: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png',
    badge: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View Booking',
        icon: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification("Tati's Cleaners", options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', function(event) {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});