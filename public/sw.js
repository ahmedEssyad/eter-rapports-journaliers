// 📱 Service Worker v3.3 - PWA Offline-First pour Employés ETER
const CACHE_NAME = 'eter-offline-v3-3';
const CACHE_VERSION = '3.3.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const API_CACHE = `${CACHE_NAME}-api`;

// 📦 Ressources essentielles pour mode offline
const ESSENTIAL_ASSETS = [
    '/',
    '/eter-form.html',
    '/css/global.css',
    '/css/components.css', 
    '/css/pwa-offline.css',
    '/js/eter-form.js',
    '/js/offline-manager.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// 📂 Ressources optionnelles (admin)
const OPTIONAL_ASSETS = [
    '/login.html',
    '/admin-dashboard.html',
    '/css/admin.css',
    '/css/auth.css',
    '/js/admin-dashboard.js',
    './css/eter-form-bootstrap.css'
];

// 🚀 Installation du Service Worker
self.addEventListener('install', event => {
    console.log('📱 Installation Service Worker v' + CACHE_VERSION);
    
    event.waitUntil(
        Promise.all([
            // Cache essentiel (formulaire employé)
            caches.open(STATIC_CACHE).then(cache => {
                console.log('📦 Mise en cache des ressources essentielles');
                return cache.addAll(ESSENTIAL_ASSETS);
            }),
            
            // Cache optionnel (admin)
            caches.open(DYNAMIC_CACHE).then(cache => {
                console.log('📦 Mise en cache des ressources optionnelles');
                return cache.addAll(OPTIONAL_ASSETS).catch(err => {
                    console.warn('⚠️ Certaines ressources optionnelles non disponibles:', err);
                });
            }),
            
            // Cache API
            caches.open(API_CACHE)
            
        ]).then(() => {
            console.log('✅ Installation Service Worker terminée');
            self.skipWaiting();
        }).catch(error => {
            console.error('❌ Erreur installation Service Worker:', error);
        })
    );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
    console.log('SW: Activation v' + CACHE_VERSION);
    
    event.waitUntil(
        Promise.all([
            // Nettoyer les anciens caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName.startsWith(CACHE_NAME) && 
                            !cacheName.includes(CACHE_VERSION)) {
                            console.log('SW: Suppression cache obsolète:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Prendre le contrôle immédiatement
            self.clients.claim()
        ]).then(() => {
            console.log('SW: Activation terminée');
            
            // Notifier les clients de la mise à jour
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: CACHE_VERSION
                    });
                });
            });
        })
    );
});

// Stratégies de cache
const cacheStrategies = {
    // Cache First - pour les ressources statiques
    cacheFirst: async (request, cacheName) => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        try {
            const response = await fetch(request);
            // Seulement mettre en cache les requêtes GET avec succès
            if (response.status === 200 && request.method === 'GET') {
                cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            console.log('SW: Échec réseau pour', request.url);
            throw error;
        }
    },
    
    // Network First - pour les données dynamiques
    networkFirst: async (request, cacheName) => {
        const cache = await caches.open(cacheName);
        
        try {
            const response = await fetch(request);
            // Seulement mettre en cache les requêtes GET avec succès
            if (response.status === 200 && request.method === 'GET') {
                cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            console.log('SW: Fallback cache pour', request.url);
            // Seulement chercher en cache pour les requêtes GET
            if (request.method === 'GET') {
                const cached = await cache.match(request);
                if (cached) {
                    return cached;
                }
            }
            throw error;
        }
    },
    
    // Stale While Revalidate - pour un équilibre performance/fraîcheur
    staleWhileRevalidate: async (request, cacheName) => {
        const cache = await caches.open(cacheName);
        
        // Seulement chercher en cache pour les requêtes GET
        const cached = request.method === 'GET' ? await cache.match(request) : null;
        
        const fetchPromise = fetch(request).then(response => {
            // Seulement mettre en cache les requêtes GET avec succès
            if (response.status === 200 && request.method === 'GET') {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(() => cached);
        
        return cached || fetchPromise;
    }
};

// 🌐 Interception des requêtes - Stratégie Offline-First
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorer les requêtes non-HTTP et extensions
    if (!request.url.startsWith('http') || url.pathname.includes('.')) {
        return;
    }
    
    // 📋 API Formulaires - Stratégie spéciale offline-first
    if (url.pathname === '/api/forms' && request.method === 'POST') {
        event.respondWith(handleFormSubmission(request));
        return;
    }
    
    // 📊 API Stats et autres GET - Cache avec fallback
    if (url.pathname.startsWith('/api/') && request.method === 'GET') {
        event.respondWith(
            cacheStrategies.networkFirst(request, API_CACHE)
                .catch(() => {
                    // Retourner données offline pour stats
                    if (url.pathname === '/api/stats') {
                        return new Response(JSON.stringify({
                            success: false,
                            offline: true,
                            message: 'Données hors ligne non disponibles'
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    throw new Error('API non disponible hors ligne');
                })
        );
        return;
    }
    
    // 🚫 Autres requêtes API (POST, PUT, DELETE) - Pas de cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                // Réponse d'erreur pour requêtes non-GET en mode offline
                return new Response(JSON.stringify({
                    success: false,
                    offline: true,
                    message: 'Action non disponible hors ligne'
                }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }
    
    // 📄 Pages HTML - Cache-first avec fallback vers formulaire
    if (request.destination === 'document') {
        event.respondWith(
            cacheStrategies.cacheFirst(request, STATIC_CACHE)
                .catch(() => {
                    // Fallback vers page formulaire employé
                    if (url.pathname !== '/' && url.pathname !== '/eter-form.html') {
                        return caches.match('/eter-form.html');
                    }
                    return caches.match('/');
                })
        );
        return;
    }
    
    // 🎨 Ressources statiques - Cache-first
    if (ESSENTIAL_ASSETS.some(asset => request.url.includes(asset)) ||
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font') {
        event.respondWith(
            cacheStrategies.cacheFirst(request, STATIC_CACHE)
        );
        return;
    }
    
    // 🖼️ Images et médias - Stale while revalidate
    if (request.destination === 'image') {
        event.respondWith(
            cacheStrategies.staleWhileRevalidate(request, DYNAMIC_CACHE)
        );
        return;
    }
    
    // 🌐 Par défaut - Network first avec cache fallback
    event.respondWith(
        cacheStrategies.networkFirst(request, DYNAMIC_CACHE)
    );
});

// 📝 Gestion spéciale soumission formulaires
async function handleFormSubmission(request) {
    try {
        console.log('📤 Tentative envoi formulaire en ligne');
        
        // Cloner la requête car elle ne peut être lue qu'une fois
        const requestClone = request.clone();
        
        // Tenter envoi direct si en ligne
        const response = await fetch(requestClone);
        
        if (response.ok) {
            console.log('✅ Formulaire envoyé avec succès');
            
            // Notifier les clients du succès
            notifyClients({
                type: 'FORM_SENT_ONLINE',
                success: true
            });
            
            return response;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.log('📴 Échec envoi en ligne - Mode offline activé');
        
        try {
            // Lire le contenu de la requête pour notification
            const formData = await request.json();
            
            // Notifier les clients de sauvegarder localement
            notifyClients({
                type: 'SAVE_FORM_OFFLINE',
                formData: formData
            });
        } catch (readError) {
            console.warn('⚠️ Impossible de lire les données du formulaire');
        }
        
        // Retourner réponse de succès simulée pour l'interface
        return new Response(JSON.stringify({
            success: true,
            offline: true,
            message: 'Formulaire sauvé hors ligne - Sera synchronisé automatiquement'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 📢 Notification aux clients
async function notifyClients(message) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage(message);
    });
}

// 🔄 Gestion des messages du client
self.addEventListener('message', event => {
    const { data } = event;
    
    switch (data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_VERSION,
                caches: [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE]
            });
            break;
            
        case 'CLEAR_CACHE':
            event.waitUntil(
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                }).then(() => {
                    event.ports[0].postMessage({ success: true });
                })
            );
            break;
            
        case 'SYNC_FORMS':
            event.waitUntil(syncPendingForms());
            break;
            
        case 'PREFETCH_ADMIN':
            // Pré-charger ressources admin si demandé
            event.waitUntil(prefetchAdminResources());
            break;
    }
});

// 🔄 Pré-chargement ressources admin
async function prefetchAdminResources() {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.addAll(OPTIONAL_ASSETS);
        console.log('✅ Ressources admin pré-chargées');
    } catch (error) {
        console.warn('⚠️ Erreur pré-chargement admin:', error);
    }
}

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
    console.log('SW: Sync event:', event.tag);
    
    switch (event.tag) {
        case 'background-sync-forms':
            event.waitUntil(syncPendingForms());
            break;
        case 'periodic-sync':
            event.waitUntil(periodicSync());
            break;
    }
});

// Notifications push (pour futures fonctionnalités)
self.addEventListener('push', event => {
    console.log('SW: Push reçu');
    
    const options = {
        body: event.data ? event.data.text() : 'Nouvelle notification',
        icon: '/manifest.json',
        badge: '/manifest.json',
        tag: 'form-notification',
        requireInteraction: false,
        actions: [
            {
                action: 'view',
                title: 'Voir',
                icon: '/manifest.json'
            },
            {
                action: 'dismiss',
                title: 'Ignorer'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Offline Form App', options)
    );
});

// Gestion des clics sur notifications
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Fonctions utilitaires
async function syncPendingForms() {
    try {
        console.log('SW: Synchronisation des formulaires en attente');
        
        const clients = await self.clients.matchAll();
        
        for (const client of clients) {
            client.postMessage({
                type: 'SYNC_PENDING_FORMS'
            });
        }
        
        console.log('SW: Synchronisation terminée');
    } catch (error) {
        console.error('SW: Erreur synchronisation:', error);
    }
}

async function periodicSync() {
    try {
        console.log('SW: Synchronisation périodique');
        
        // Nettoyer les caches dynamiques anciens
        const dynamicCache = await caches.open(DYNAMIC_CACHE);
        const requests = await dynamicCache.keys();
        
        const oldRequests = requests.filter(request => {
            const url = new URL(request.url);
            return url.pathname.startsWith('/api/') && 
                   Date.now() - request.headers.get('date') > 3600000; // 1 heure
        });
        
        await Promise.all(
            oldRequests.map(request => dynamicCache.delete(request))
        );
        
        console.log('SW: Nettoyage cache terminé');
    } catch (error) {
        console.error('SW: Erreur sync périodique:', error);
    }
}

// 🚨 Gestion des erreurs globales améliorée
self.addEventListener('error', event => {
    console.error('SW: Erreur globale:', event.error);
    // Ne pas propager l'erreur pour éviter les messages dans la console
    event.preventDefault();
});

self.addEventListener('unhandledrejection', event => {
    console.error('SW: Promise rejetée:', event.reason);
    // Ne pas propager pour les erreurs de cache courantes
    if (event.reason && event.reason.message && 
        (event.reason.message.includes('Request method') || 
         event.reason.message.includes('Cache'))) {
        event.preventDefault();
    }
});

console.log('SW: Service Worker v' + CACHE_VERSION + ' initialisé');