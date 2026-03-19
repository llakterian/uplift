// Service Worker for PWA and Push Notifications

const CACHE_NAME = 'uplift-cache-v2'
const DYNAMIC_CACHE_NAME = 'uplift-dynamic-v2'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo.jpg'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .catch(error => console.error('[SW] Install failed:', error))
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE_NAME)
            .map(name => caches.delete(name))
        )
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up')
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // For API requests, use network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          if (response.ok && url.pathname.includes('/feed')) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(event.request, clone)
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request)
        })
    )
    return
  }
  
  // For static assets, use cache first
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          // Update cache in background
          fetch(event.request).then(response => {
            if (response.ok) {
              caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                cache.put(event.request, response)
              })
            }
          })
          return cached
        }
        
        return fetch(event.request).then(response => {
          // Cache new responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE_NAME).then(cache => {
              cache.put(event.request, clone)
            })
          }
          return response
        }).catch(() => {
          // Offline fallback for HTML requests
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html')
          }
        })
      })
  )
})

// Push notification event
self.addEventListener('push', (event) => {
  let data = {}
  
  try {
    data = event.data.json()
  } catch {
    data = {
      title: '🌟 Your Daily Spark',
      body: 'Something beautiful happened today! ❤️',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-512.png'
    }
  }
  
  const options = {
    body: data.body || 'Your daily dose of good news is here!',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-512.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      {
        action: 'open',
        title: 'Open Uplift',
        icon: '/icons/icon-192.png'
      }
    ],
    requireInteraction: false,
    silent: false
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || '🌟 Uplift', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/' || client.url.startsWith('/?') && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data || '/')
        }
      })
  )
})

// Background sync for offline usage
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncBookmarks())
  }
})

// Sync bookmarks when coming back online
async function syncBookmarks() {
  try {
    console.log('[SW] Syncing bookmarks...')
    // Sync logic would go here
  } catch (error) {
    console.error('[SW] Sync failed:', error)
  }
}

// Message event for communication from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(name => caches.delete(name))
        )
      })
    )
  }
})

// Periodic sync for daily digest (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-digest') {
      console.log('[SW] Periodic sync for daily digest')
      event.waitUntil(
        fetch('/api/daily-digest?stream=false')
      )
    }
  })
}

console.log('[SW] Service Worker loaded')