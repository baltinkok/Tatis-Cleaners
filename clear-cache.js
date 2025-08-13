// Cache clearing script for development/deployment
// This can be run to force clear service worker caches

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    console.log('Found', registrations.length, 'service worker registrations');
    
    for(let registration of registrations) {
      console.log('Unregistering service worker:', registration.scope);
      registration.unregister();
    }
  });
}

// Clear all caches
if ('caches' in window) {
  caches.keys().then(function(cacheNames) {
    console.log('Found', cacheNames.length, 'caches');
    
    return Promise.all(
      cacheNames.map(function(cacheName) {
        console.log('Deleting cache:', cacheName);
        return caches.delete(cacheName);
      })
    );
  }).then(function() {
    console.log('All caches cleared successfully');
    console.log('Please refresh the page to see updates');
  });
}