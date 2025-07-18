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

// Initialize enhancements when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancements);
} else {
    initializeEnhancements();
}