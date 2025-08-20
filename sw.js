// Define a name for our cache
const CORE_CACHE_NAME = 'deadbolt-core-v1';
const EXTERNAL_CACHE_NAME = 'deadbolt-external-v1';

// 1. Define your core, local assets
const coreAssets = [
  '/',
  '/assets/css/main.css',
  '/assets/images/deadbolt.png',
  '/assets/images/deadbolt-invert.png',
  '/js/deadbolt.js',
  '/favicon.ico'
];

// 2. Define the essential external assets
// IMPORTANT: You need to find the actual .woff2 font file URL inside the Google Fonts CSS file.
const essentialExternalAssets = [
  'https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap',
  'https://kit.fontawesome.com/e79216d307.js',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://ka-f.fontawesome.com/releases/v6.7.2/css/free.min.css?token=e79216d307',
  'https://ka-f.fontawesome.com/releases/v6.7.2/css/free-v4-shims.min.css?token=e79216d307',
  'https://ka-f.fontawesome.com/releases/v6.7.2/css/free-v5-font-face.min.css?token=e79216d307',
  'https://ka-f.fontawesome.com/releases/v6.7.2/css/free-v4-font-face.min.css?token=e79216d307',
  'https://fonts.gstatic.com/s/courierprime/v10/u-4n0q2lgwslOqpF_6gQ8kELawRZWMf6.woff2',
  'https://fonts.gstatic.com/s/courierprime/v10/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2',
  'https://ka-f.fontawesome.com/releases/v6.7.2/webfonts/free-fa-solid-900.woff2',
  'https://ka-f.fontawesome.com/releases/v6.7.2/webfonts/free-fa-regular-400.woff2',
  'https://fonts.gstatic.com/s/courierprime/v10/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfqw.woff2'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(cache => {
      // Stage 1: Cache the reliable core assets.
      // This is fast and is not expected to fail.
      const coreAssetsPromise = cache.addAll(coreAssets);

      // Stage 2: Cache the essential external assets individually.
      // We handle failures gracefully so they don't break the install.
      const externalAssetsPromises = essentialExternalAssets.map(url => {
        return fetch(url, { mode: 'cors' }) // Use 'cors' mode for cross-origin requests
          .then(response => {
            if (!response.ok) {
              throw new Error(`Request to ${url} failed with status ${response.statusText}`);
            }
            return cache.put(url, response);
          })
          .catch(err => {
            // This is the key part: we log the error but don't re-throw it.
            // This prevents a failed font download from failing the entire service worker install.
            console.warn(`Could not cache essential external asset: ${url}`, err);
          });
      });
      
      // Wait until both core and optional external assets are processed.
      return Promise.all([coreAssetsPromise, ...externalAssetsPromises]);
    })
  );
});

// The fetch event - fired every time the app requests a resource (e.g., a file, an image).
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
      // If it's a POST, PUT, etc., do not cache it.
      // Let it pass through to the network directly.
      return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
    // If it's not a standard HTTP request, do nothing and let it pass through.
    // This ignores chrome-extension://, data:, etc.
    return;
  }

  // Check if the request is for an external resource
  if (requestUrl.origin !== self.location.origin) {
    
    // Use a "stale-while-revalidate" strategy for all external requests.
    event.respondWith(
      caches.open(EXTERNAL_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // 1. Return the cached response if it exists (stale)
          const fetchPromise = fetch(event.request).then(networkResponse => {
            // 2. While revalidating: update the cache with the new response
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });

          // Return the cached version immediately, while the fetch happens in the background.
          return cachedResponse || fetchPromise;
        });
      })
    );
    return; // End execution for external requests
  }

  // For your own assets, use a "cache-first" strategy.
  // This is fast and reliable for your versioned app shell.
  event.respondWith(
    caches.open(CORE_CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        return response || fetch(event.request);
      });
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CORE_CACHE_NAME]; // The new, current cache

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If the cache name isn't in our whitelist, delete it
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});