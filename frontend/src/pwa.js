// PWA Service Worker Registration
// This file handles the service worker registration and PWA install prompts

let deferredPrompt;
let isInstalled = false;

// Check if app is already installed
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  isInstalled = true;
  console.log('PWA: App is running in standalone mode');
}

// Register Service Worker
export const registerSW = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('PWA: Service Worker registered successfully', registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  console.log('PWA: New content is available');
                  showUpdateNotification();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('PWA: Service Worker registration failed', error);
        });
    });
  } else {
    console.log('PWA: Service Worker not supported');
  }
};

// Show update notification
const showUpdateNotification = () => {
  if (confirm('A new version is available. Would you like to update?')) {
    window.location.reload();
  }
};

// Handle install prompt
export const initializeInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA: Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // Show custom install button if not already installed
    if (!isInstalled) {
      showInstallButton();
    }
  });

  // Track if app was installed
  window.addEventListener('appinstalled', (evt) => {
    console.log('PWA: App was installed', evt);
    isInstalled = true;
    hideInstallButton();
    
    // Track installation
    if (window.gtag) {
      window.gtag('event', 'pwa_install', {
        event_category: 'PWA',
        event_label: 'App Installed'
      });
    }
  });
};

// Show install button
const showInstallButton = () => {
  // Create install button if it doesn't exist
  let installButton = document.getElementById('pwa-install-button');
  
  if (!installButton) {
    installButton = document.createElement('button');
    installButton.id = 'pwa-install-button';
    installButton.innerHTML = `
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
      </svg>
      Install App
    `;
    installButton.className = `
      fixed bottom-20 right-4 z-50 flex items-center 
      bg-emerald-600 hover:bg-emerald-700 text-white 
      px-4 py-2 rounded-lg shadow-lg text-sm font-medium
      transition-all duration-200 hover:shadow-xl
    `;
    installButton.style.display = 'flex';
    
    document.body.appendChild(installButton);
    
    installButton.addEventListener('click', handleInstallClick);
  }
  
  installButton.style.display = 'flex';
};

// Hide install button
const hideInstallButton = () => {
  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'none';
  }
};

// Handle install button click
const handleInstallClick = async () => {
  if (!deferredPrompt) {
    console.log('PWA: Install prompt not available');
    return;
  }

  const installButton = document.getElementById('pwa-install-button');
  if (installButton) {
    installButton.style.display = 'none';
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('PWA: User accepted the install prompt');
  } else {
    console.log('PWA: User dismissed the install prompt');
    // Show button again after 5 seconds if user dismissed
    setTimeout(showInstallButton, 5000);
  }

  deferredPrompt = null;
};

// Check if PWA features are supported
export const checkPWASupport = () => {
  const support = {
    serviceWorker: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window,
    notifications: 'Notification' in window,
    installPrompt: 'beforeinstallprompt' in window || 
                   window.matchMedia('(display-mode: standalone)').matches,
    offline: 'caches' in window
  };
  
  console.log('PWA: Feature support', support);
  return support;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    console.log('PWA: Notification permission', permission);
    return permission === 'granted';
  }
  return false;
};

// Show notification (if permission granted)
export const showNotification = (title, options = {}) => {
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        icon: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png',
        badge: 'https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png',
        vibrate: [200, 100, 200],
        ...options
      });
    });
  }
};

// Check connection status
export const checkOnlineStatus = () => {
  const updateOnlineStatus = () => {
    const status = navigator.onLine ? 'online' : 'offline';
    console.log('PWA: Connection status', status);
    
    // Show offline indicator
    if (!navigator.onLine) {
      showOfflineIndicator();
    } else {
      hideOfflineIndicator();
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
};

// Show offline indicator
const showOfflineIndicator = () => {
  let offlineIndicator = document.getElementById('offline-indicator');
  
  if (!offlineIndicator) {
    offlineIndicator = document.createElement('div');
    offlineIndicator.id = 'offline-indicator';
    offlineIndicator.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span>You're offline</span>
      </div>
    `;
    offlineIndicator.className = `
      fixed top-0 left-0 right-0 z-50 
      bg-red-600 text-white text-center 
      py-2 px-4 text-sm font-medium
    `;
    
    document.body.appendChild(offlineIndicator);
  }
  
  offlineIndicator.style.display = 'block';
};

// Hide offline indicator
const hideOfflineIndicator = () => {
  const offlineIndicator = document.getElementById('offline-indicator');
  if (offlineIndicator) {
    offlineIndicator.style.display = 'none';
  }
};