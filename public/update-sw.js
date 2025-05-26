// 🔄 Script de mise à jour Service Worker
// À exécuter dans la console du navigateur pour forcer la mise à jour

async function updateServiceWorker() {
    console.log('🔄 Mise à jour Service Worker...');
    
    try {
        // Désenregistrer l'ancien Service Worker
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            console.log('🗑️ Suppression ancien SW:', registration.scope);
            await registration.unregister();
        }
        
        // Vider tous les caches
        const cacheNames = await caches.keys();
        for (let cacheName of cacheNames) {
            console.log('🗑️ Suppression cache:', cacheName);
            await caches.delete(cacheName);
        }
        
        // Attendre un peu
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Réenregistrer le nouveau Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Nouveau SW enregistré:', registration);
        
        // Forcer l'activation
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        console.log('🎉 Mise à jour terminée - Rechargez la page');
        
    } catch (error) {
        console.error('❌ Erreur mise à jour SW:', error);
    }
}

// Exécuter la mise à jour
updateServiceWorker();