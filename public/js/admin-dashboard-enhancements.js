/**
 * Enhanced Dashboard Functions
 * Additional functionality for the admin dashboard
 */

// Enhanced Dashboard Functions
function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <div class="toast-meta">${new Date().toLocaleTimeString('fr-FR')}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.remove();
    }, duration);
    
    // Click to remove
    toast.addEventListener('click', () => {
        toast.remove();
    });
}

function setupNetworkMonitoring() {
    const updateNetworkStatus = () => {
        const indicator = document.querySelector('.network-indicator');
        const dot = document.querySelector('.indicator-dot');
        const text = document.querySelector('.indicator-text');
        
        if (!indicator || !dot || !text) return;
        
        if (navigator.onLine) {
            indicator.className = 'network-indicator online';
            dot.className = 'indicator-dot';
            text.textContent = 'En ligne';
        } else {
            indicator.className = 'network-indicator offline';
            dot.className = 'indicator-dot offline';
            text.textContent = 'Hors ligne';
        }
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
}

function refreshData() {
    showLoadingOverlay();
    if (typeof loadReports === 'function') {
        loadReports();
    }
    showToast('Données actualisées', 'success');
    setTimeout(hideLoadingOverlay, 1000);
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'r':
                    e.preventDefault();
                    refreshData();
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput')?.focus();
                    break;
                case 'e':
                    e.preventDefault();
                    if (typeof exportAllReports === 'function') {
                        exportAllReports();
                    }
                    break;
            }
        }
    });
}

function enhanceStatsCards() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
        
        // Add click animation
        card.addEventListener('click', () => {
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
                card.style.transform = 'translateY(-8px)';
            }, 150);
        });
    });
}

function enhanceTableInteractions() {
    const table = document.querySelector('.reports-table');
    if (!table) return;
    
    // Add row hover effects
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.backgroundColor = 'var(--light-color)';
        });
        
        row.addEventListener('mouseleave', () => {
            row.style.backgroundColor = '';
        });
    });
}

function updateDashboardStats() {
    // Simulate real-time stats update
    const statsElements = [
        { id: 'totalReports', min: 150, max: 300 },
        { id: 'totalVehicles', min: 25, max: 50 },
        { id: 'totalDrivers', min: 20, max: 40 },
        { id: 'totalFuel', min: 2000, max: 5000 }
    ];
    
    statsElements.forEach(stat => {
        const element = document.getElementById(stat.id);
        if (element) {
            const currentValue = parseInt(element.textContent) || 0;
            const change = Math.random() > 0.5 ? 1 : -1;
            const newValue = Math.max(stat.min, Math.min(stat.max, currentValue + change));
            
            // Animate the change
            element.style.transform = 'scale(1.1)';
            element.style.color = 'var(--primary-color)';
            
            setTimeout(() => {
                element.textContent = newValue;
                element.style.transform = 'scale(1)';
                element.style.color = '';
            }, 200);
        }
    });
}

function initializeEnhancements() {
    // Setup network monitoring
    setupNetworkMonitoring();
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Enhance stats cards
    enhanceStatsCards();
    
    // Enhance table interactions
    enhanceTableInteractions();
    
    // Hide loading overlay initially
    hideLoadingOverlay();
    
    // Show welcome toast
    setTimeout(() => {
        showToast('Dashboard amélioré chargé avec succès', 'success');
    }, 1000);
    
    // Update stats periodically
    setInterval(updateDashboardStats, 30000);
}

// === FONCTIONS DE SAUVEGARDE ===

// Fonction pour créer une sauvegarde
async function createBackup() {
    try {
        showLoadingOverlay();
        showToast('Création de la sauvegarde...', 'info');
        
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/backup/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la création de la sauvegarde');
        }

        const result = await response.json();
        
        // Télécharger le fichier de sauvegarde
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { 
            type: 'application/json' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('Sauvegarde créée et téléchargée avec succès', 'success');
        
        // Mettre à jour les statistiques
        await updateBackupStats();
        
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        showToast('Erreur lors de la création de la sauvegarde', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// Fonction pour restaurer une sauvegarde
async function restoreBackup(backupData) {
    try {
        if (!backupData) {
            showToast('Aucune donnée de sauvegarde fournie', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir restaurer cette sauvegarde ? Cette action peut écraser les données existantes.')) {
            return;
        }

        showLoadingOverlay();
        showToast('Restauration en cours...', 'info');
        
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/backup/restore', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ backupData })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la restauration');
        }

        const result = await response.json();
        
        showToast(`Sauvegarde restaurée : ${result.data.formsRestored} formulaires`, 'success');
        
        // Recharger les données
        setTimeout(() => {
            if (typeof loadReports === 'function') {
                loadReports();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Erreur restauration:', error);
        showToast('Erreur lors de la restauration', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// Fonction pour obtenir les statistiques de sauvegarde
async function getBackupStats() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/backup/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des statistiques');
        }

        const result = await response.json();
        return result.data;
        
    } catch (error) {
        console.error('Erreur stats sauvegarde:', error);
        return null;
    }
}

// Fonction pour mettre à jour les statistiques dans l'interface
async function updateBackupStats() {
    try {
        const stats = await getBackupStats();
        if (!stats) return;

        // Mettre à jour les éléments de l'interface
        const statsContainer = document.getElementById('backupStats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="backup-stat">
                    <span class="stat-label">Nombre de sauvegardes:</span>
                    <span class="stat-value">${stats.totalBackups}</span>
                </div>
                <div class="backup-stat">
                    <span class="stat-label">Taille totale:</span>
                    <span class="stat-value">${stats.totalSizeFormatted}</span>
                </div>
                <div class="backup-stat">
                    <span class="stat-label">Dernière sauvegarde:</span>
                    <span class="stat-value">${stats.latestBackup ? 
                        new Date(stats.latestBackup.created).toLocaleString('fr-FR') : 
                        'Aucune'}</span>
                </div>
                <div class="backup-stat">
                    <span class="stat-label">Sauvegarde automatique:</span>
                    <span class="stat-value">${stats.autoBackupEnabled ? 
                        `Activée (${stats.autoBackupSchedule})` : 
                        'Désactivée'}</span>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Erreur mise à jour stats:', error);
    }
}

// Fonction pour configurer la sauvegarde automatique
async function configureAutoBackup(schedule) {
    try {
        showLoadingOverlay();
        
        const token = localStorage.getItem('adminToken');
        const response = await fetch('/api/admin/backup/auto', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schedule })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la configuration');
        }

        const result = await response.json();
        
        showToast(`Sauvegarde automatique configurée : ${schedule}`, 'success');
        
        // Mettre à jour les statistiques
        await updateBackupStats();
        
    } catch (error) {
        console.error('Erreur config auto backup:', error);
        showToast('Erreur lors de la configuration', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// Fonction pour gérer l'upload de fichier de sauvegarde
function handleBackupFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        showToast('Veuillez sélectionner un fichier JSON', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            await restoreBackup(backupData);
        } catch (error) {
            console.error('Erreur lecture fichier:', error);
            showToast('Fichier de sauvegarde invalide', 'error');
        }
    };
    reader.readAsText(file);
}

// Fonction pour afficher le modal de sauvegarde
function showBackupModal() {
    let modal = document.getElementById('backupModal');
    if (!modal) {
        // Créer le modal s'il n'existe pas
        createBackupModal();
        modal = document.getElementById('backupModal');
    }
    
    modal.style.display = 'block';
    updateBackupStats();
}

// Fonction pour créer le modal de sauvegarde
function createBackupModal() {
    const modalHTML = `
        <div id="backupModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">💾 Gestion des Sauvegardes</h3>
                    <button class="close-btn" onclick="closeBackupModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="backup-section">
                        <h4>Créer une Sauvegarde</h4>
                        <p>Créez une sauvegarde complète de tous les rapports et données.</p>
                        <button class="btn btn-primary" onclick="createBackup()">
                            📦 Créer Sauvegarde
                        </button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>Restaurer une Sauvegarde</h4>
                        <p>Restaurez des données à partir d'un fichier de sauvegarde.</p>
                        <input type="file" id="backupFileInput" accept=".json" 
                               onchange="handleBackupFileUpload(event)" style="display: none;">
                        <button class="btn btn-secondary" onclick="document.getElementById('backupFileInput').click()">
                            📂 Sélectionner Fichier
                        </button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>Sauvegarde Automatique</h4>
                        <p>Configurez la fréquence des sauvegardes automatiques.</p>
                        <select id="autoBackupSchedule">
                            <option value="daily">Quotidienne</option>
                            <option value="weekly">Hebdomadaire</option>
                            <option value="monthly">Mensuelle</option>
                        </select>
                        <button class="btn btn-warning" onclick="configureAutoBackup(document.getElementById('autoBackupSchedule').value)">
                            ⚙️ Configurer
                        </button>
                    </div>
                    
                    <div class="backup-section">
                        <h4>Statistiques</h4>
                        <div id="backupStats">
                            <div class="loading">Chargement...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Ajouter les styles CSS
    const style = document.createElement('style');
    style.textContent = `
        .backup-section {
            margin-bottom: 2rem;
            padding: 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #f8fafc;
        }
        
        .backup-section h4 {
            margin-bottom: 0.5rem;
            color: var(--primary-color);
        }
        
        .backup-section p {
            margin-bottom: 1rem;
            color: var(--secondary-color);
            font-size: 0.875rem;
        }
        
        .backup-stat {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: white;
            border-radius: 4px;
        }
        
        .stat-label {
            font-weight: 500;
        }
        
        .stat-value {
            color: var(--primary-color);
            font-weight: 600;
        }
        
        #autoBackupSchedule {
            margin-right: 1rem;
            padding: 0.5rem;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
}

// Fonction pour fermer le modal de sauvegarde
function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fonction principale showBackup (appelée depuis le dashboard)
function showBackup() {
    showBackupModal();
}

// Initialize enhancements when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancements);
} else {
    initializeEnhancements();
}