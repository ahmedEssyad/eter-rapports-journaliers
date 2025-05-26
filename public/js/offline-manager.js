// 📱 Offline Manager - Gestionnaire hors ligne pour employés ETER
// Version: 3.0 - PWA Offline-First

console.log('📱 Chargement OfflineManager...');

// Éviter les redéclarations
if (typeof window.OfflineManager === 'undefined') {
    
class OfflineManager {
    constructor() {
        console.log('🔧 Initialisation OfflineManager...');
        this.dbName = 'ETER_OfflineDB';
        this.dbVersion = 3;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.pendingForms = new Map();
        this.syncInProgress = false;
        this.maxRetries = 3;
        this.retryDelay = 2000;
        
        console.log('📊 État initial:', {
            isOnline: this.isOnline,
            pendingForms: this.pendingForms.size
        });
        
        this.initDB();
        this.setupEventListeners();
        this.setupSyncInterval();
        this.showNetworkStatus();
        
        console.log('✅ OfflineManager initialisé - Mode:', this.isOnline ? 'En ligne' : 'Hors ligne');
    }

    // 🗄️ Initialisation IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('❌ Erreur ouverture IndexedDB:', request.error);
                this.showToast('Erreur initialisation base locale', 'error');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialisée avec succès');
                this.loadPendingForms();
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔄 Mise à jour structure IndexedDB');
                
                // Store pour formulaires en attente
                if (!db.objectStoreNames.contains('pendingForms')) {
                    const formsStore = db.createObjectStore('pendingForms', { 
                        keyPath: 'id' 
                    });
                    formsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    formsStore.createIndex('status', 'status', { unique: false });
                }
                
                // Store pour signatures temporaires
                if (!db.objectStoreNames.contains('signatures')) {
                    const sigStore = db.createObjectStore('signatures', { 
                        keyPath: 'formId' 
                    });
                }
                
                // Store pour cache utilisateur
                if (!db.objectStoreNames.contains('userCache')) {
                    const cacheStore = db.createObjectStore('userCache', { 
                        keyPath: 'key' 
                    });
                }
                
                console.log('✅ Structure IndexedDB mise à jour');
            };
        });
    }

    // 🌐 Configuration des événements réseau
    setupEventListeners() {
        // Détection changement statut réseau
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Connexion rétablie');
            this.showToast('Connexion rétablie - Synchronisation...', 'success');
            this.showNetworkStatus();
            this.syncPendingForms();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 Mode hors ligne activé');
            this.showToast('Mode hors ligne - Données sauvées localement', 'info');
            this.showNetworkStatus();
        });

        // Gestion des messages du Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                const { data } = event;
                
                switch (data.type) {
                    case 'SYNC_PENDING_FORMS':
                        this.syncPendingForms();
                        break;
                    case 'SW_UPDATED':
                        this.showToast('Application mise à jour disponible', 'info');
                        break;
                }
            });
        }

        // Synchronisation avant fermeture page
        window.addEventListener('beforeunload', () => {
            if (this.isOnline && this.pendingForms.size > 0) {
                this.syncPendingForms();
            }
        });
    }

    // ⏰ Configuration synchronisation périodique
    setupSyncInterval() {
        // Sync toutes les 30 secondes si en ligne
        setInterval(() => {
            if (this.isOnline && this.pendingForms.size > 0 && !this.syncInProgress) {
                this.syncPendingForms();
            }
        }, 30000);

        // Vérification statut réseau toutes les 10 secondes
        setInterval(() => {
            const currentStatus = navigator.onLine;
            if (currentStatus !== this.isOnline) {
                this.isOnline = currentStatus;
                this.showNetworkStatus();
                
                if (this.isOnline) {
                    this.syncPendingForms();
                }
            }
        }, 10000);
    }

    // 💾 Sauvegarde formulaire hors ligne
    async saveFormOffline(formData) {
        try {
            const formId = this.generateFormId();
            const formRecord = {
                id: formId,
                data: formData,
                timestamp: new Date().toISOString(),
                status: 'pending',
                retryCount: 0,
                lastError: null,
                createdOffline: !this.isOnline
            };

            // Sauvegarder dans IndexedDB
            await this.saveToIndexedDB('pendingForms', formRecord);
            
            // Ajouter à la Map en mémoire
            this.pendingForms.set(formId, formRecord);
            
            console.log('💾 Formulaire sauvé hors ligne:', formId);
            this.updatePendingFormsUI();
            
            // Tentative sync immédiate si en ligne
            if (this.isOnline) {
                this.syncSingleForm(formId);
            } else {
                this.showToast('Formulaire sauvé en local - Sera synchronisé automatiquement', 'success');
            }
            
            return formId;
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde hors ligne:', error);
            this.showToast('Erreur sauvegarde locale', 'error');
            throw error;
        }
    }

    // 🔄 Synchronisation des formulaires en attente
    async syncPendingForms() {
        if (this.syncInProgress || !this.isOnline || this.pendingForms.size === 0) {
            return;
        }

        this.syncInProgress = true;
        console.log(`🔄 Début synchronisation de ${this.pendingForms.size} formulaires`);
        
        const syncButton = document.getElementById('syncButton');
        if (syncButton) {
            syncButton.disabled = true;
            syncButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synchronisation...';
        }

        let syncedCount = 0;
        let errorCount = 0;

        for (const [formId, formRecord] of this.pendingForms) {
            try {
                const success = await this.syncSingleForm(formId);
                if (success) {
                    syncedCount++;
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Erreur sync formulaire ${formId}:`, error);
            }
        }

        this.syncInProgress = false;
        
        if (syncButton) {
            syncButton.disabled = false;
            syncButton.innerHTML = '<i class="fas fa-sync"></i> Synchroniser';
        }

        // Afficher résultat
        if (syncedCount > 0) {
            this.showToast(`✅ ${syncedCount} formulaire(s) synchronisé(s)`, 'success');
        }
        
        if (errorCount > 0) {
            this.showToast(`⚠️ ${errorCount} erreur(s) de synchronisation`, 'warning');
        }

        this.updatePendingFormsUI();
        console.log(`✅ Synchronisation terminée: ${syncedCount} succès, ${errorCount} erreurs`);
    }

    // 📤 Synchronisation d'un formulaire unique
    async syncSingleForm(formId) {
        const formRecord = this.pendingForms.get(formId);
        if (!formRecord) return false;

        try {
            console.log(`📤 Synchronisation formulaire ${formId}`);
            
            const response = await fetch('/api/forms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formRecord.data)
            });

            if (response.ok) {
                // Succès - Supprimer de la file d'attente
                await this.removeFromIndexedDB('pendingForms', formId);
                this.pendingForms.delete(formId);
                
                console.log(`✅ Formulaire ${formId} synchronisé avec succès`);
                return true;
                
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            // Échec - Incrémenter compteur retry
            formRecord.retryCount++;
            formRecord.lastError = error.message;
            formRecord.lastRetry = new Date().toISOString();
            
            if (formRecord.retryCount >= this.maxRetries) {
                formRecord.status = 'failed';
                this.showToast(`❌ Échec définitif formulaire ${formId}`, 'error');
            } else {
                formRecord.status = 'retrying';
                // Programmer nouveau retry avec délai exponentiel
                setTimeout(() => {
                    if (this.isOnline) {
                        this.syncSingleForm(formId);
                    }
                }, this.retryDelay * Math.pow(2, formRecord.retryCount));
            }
            
            // Mettre à jour en base
            await this.saveToIndexedDB('pendingForms', formRecord);
            this.pendingForms.set(formId, formRecord);
            
            console.error(`❌ Échec sync ${formId} (tentative ${formRecord.retryCount}):`, error);
            return false;
        }
    }

    // 🔄 Chargement des formulaires en attente au démarrage
    async loadPendingForms() {
        try {
            const forms = await this.getAllFromIndexedDB('pendingForms');
            
            for (const form of forms) {
                this.pendingForms.set(form.id, form);
            }
            
            console.log(`📋 ${forms.length} formulaires en attente chargés`);
            this.updatePendingFormsUI();
            
            // Sync automatique si en ligne
            if (this.isOnline && forms.length > 0) {
                setTimeout(() => this.syncPendingForms(), 2000);
            }
            
        } catch (error) {
            console.error('❌ Erreur chargement formulaires en attente:', error);
        }
    }

    // 🗄️ Opérations IndexedDB
    async saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFromIndexedDB(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 🎨 Interface utilisateur
    showNetworkStatus() {
        const statusIndicator = document.getElementById('networkStatus');
        if (!statusIndicator) return;

        if (this.isOnline) {
            statusIndicator.className = 'network-status online';
            statusIndicator.innerHTML = '<i class="fas fa-wifi"></i> En ligne';
        } else {
            statusIndicator.className = 'network-status offline';
            statusIndicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Hors ligne';
        }
    }

    updatePendingFormsUI() {
        const pendingCount = document.getElementById('pendingFormsCount');
        const pendingList = document.getElementById('pendingFormsList');
        const syncButton = document.getElementById('syncButton');
        
        const count = this.pendingForms.size;
        
        if (pendingCount) {
            pendingCount.textContent = count;
            pendingCount.style.display = count > 0 ? 'inline' : 'none';
        }
        
        if (syncButton) {
            syncButton.style.display = count > 0 && this.isOnline ? 'inline-block' : 'none';
        }
        
        if (pendingList) {
            pendingList.innerHTML = '';
            
            if (count === 0) {
                pendingList.innerHTML = '<div class="no-pending">Aucun formulaire en attente</div>';
            } else {
                for (const [formId, form] of this.pendingForms) {
                    const item = this.createPendingFormItem(formId, form);
                    pendingList.appendChild(item);
                }
            }
        }
    }

    createPendingFormItem(formId, form) {
        const item = document.createElement('div');
        item.className = `pending-form-item ${form.status}`;
        
        const statusIcon = {
            'pending': '<i class="fas fa-clock text-warning"></i>',
            'retrying': '<i class="fas fa-redo text-info"></i>',
            'failed': '<i class="fas fa-exclamation-triangle text-danger"></i>'
        }[form.status] || '<i class="fas fa-question"></i>';
        
        const date = new Date(form.timestamp).toLocaleString('fr-FR');
        const depot = form.data.depot || 'N/A';
        
        item.innerHTML = `
            <div class="pending-form-header">
                ${statusIcon}
                <strong>Formulaire ${formId.slice(-8)}</strong>
                <span class="pending-form-date">${date}</span>
            </div>
            <div class="pending-form-details">
                <small>Dépôt: ${depot}</small>
                ${form.retryCount > 0 ? `<small class="retry-info">Tentatives: ${form.retryCount}/${this.maxRetries}</small>` : ''}
                ${form.lastError ? `<small class="error-info">Erreur: ${form.lastError}</small>` : ''}
            </div>
            <div class="pending-form-actions">
                <button onclick="offlineManager.retrySingleForm('${formId}')" class="btn-retry" ${!this.isOnline ? 'disabled' : ''}>
                    <i class="fas fa-redo"></i> Réessayer
                </button>
                <button onclick="offlineManager.deletePendingForm('${formId}')" class="btn-delete">
                    <i class="fas fa-trash"></i> Supprimer
                </button>
            </div>
        `;
        
        return item;
    }

    // 🔧 Actions utilisateur
    async retrySingleForm(formId) {
        if (!this.isOnline) {
            this.showToast('Connexion requise pour réessayer', 'warning');
            return;
        }
        
        const form = this.pendingForms.get(formId);
        if (form) {
            form.retryCount = 0;
            form.status = 'pending';
            await this.saveToIndexedDB('pendingForms', form);
            this.syncSingleForm(formId);
        }
    }

    async deletePendingForm(formId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce formulaire en attente ?')) {
            await this.removeFromIndexedDB('pendingForms', formId);
            this.pendingForms.delete(formId);
            this.updatePendingFormsUI();
            this.showToast('Formulaire supprimé', 'info');
        }
    }

    // 🆔 Génération ID unique
    generateFormId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `form_${timestamp}_${random}`;
    }

    // 🔔 Notifications toast
    showToast(message, type = 'info', duration = 4000) {
        // Créer conteneur toast s'il n'existe pas
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // Créer toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle', 
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        }[type] || 'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Animation d'entrée
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Suppression automatique
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // 📊 Statistiques hors ligne
    getOfflineStats() {
        return {
            totalPending: this.pendingForms.size,
            pendingForms: Array.from(this.pendingForms.values()),
            isOnline: this.isOnline,
            dbConnected: !!this.db,
            syncInProgress: this.syncInProgress
        };
    }
}

// Exposer la classe globalement
window.OfflineManager = OfflineManager;

} // Fin du if typeof window.OfflineManager === 'undefined'

// Exposer la classe globalement  
window.OfflineManager = window.OfflineManager || OfflineManager;

// 🌟 Instance globale
let offlineManager;

// 🚀 Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM ready - Initialisation OfflineManager');
    try {
        if (!window.offlineManager) {
            offlineManager = new window.OfflineManager();
            window.offlineManager = offlineManager; // Rendre global
            console.log('✅ OfflineManager prêt pour les employés ETER');
            
            // Émettre un événement personnalisé
            window.dispatchEvent(new CustomEvent('offlineManagerReady', { 
                detail: { offlineManager } 
            }));
        }
        
    } catch (error) {
        console.error('❌ Erreur initialisation OfflineManager:', error);
    }
});

// 🚀 Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM ready - Initialisation OfflineManager');
    try {
        if (!window.offlineManager) {
            offlineManager = new window.OfflineManager();
            window.offlineManager = offlineManager; // Rendre global
            console.log('✅ OfflineManager prêt pour les employés ETER');
            
            // Émettre un événement personnalisé
            window.dispatchEvent(new CustomEvent('offlineManagerReady', { 
                detail: { offlineManager } 
            }));
        }
        
    } catch (error) {
        console.error('❌ Erreur initialisation OfflineManager:', error);
    }
});

// 📱 Export pour utilisation externe
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
}

console.log('📁 Script offline-manager.js chargé');