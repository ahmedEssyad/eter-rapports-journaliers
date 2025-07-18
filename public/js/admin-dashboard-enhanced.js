/**
 * Enhanced Admin Dashboard JavaScript
 * Version 2.0 - Advanced Features and Improved UX
 */

class EnhancedAdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortColumn = 'date';
        this.sortDirection = 'desc';
        this.selectedReports = new Set();
        this.filters = {};
        this.charts = {};
        this.activities = [];
        this.settings = this.loadSettings();
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupNetworkMonitoring();
        this.updateDateTime();
        this.loadInitialData();
        this.initializeCharts();
        this.startPeriodicUpdates();
        this.hideLoadingOverlay();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });

        // Filters
        document.getElementById('periodSelect')?.addEventListener('change', () => {
            this.updateReportsChart();
        });

        document.getElementById('analyticsTimeframe')?.addEventListener('change', () => {
            this.refreshAnalytics();
        });

        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.textContent.toLowerCase().split(' ')[1];
                this.showSettingsTab(tabName);
            });
        });

        // Search
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.debounce(() => this.searchReports(e.target.value), 300);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Modal close on click outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    setupNetworkMonitoring() {
        const updateNetworkStatus = () => {
            this.isOnline = navigator.onLine;
            const indicator = document.querySelector('.network-indicator');
            const dot = document.querySelector('.indicator-dot');
            const text = document.querySelector('.indicator-text');
            
            if (this.isOnline) {
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

    updateDateTime() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const dateTimeElement = document.getElementById('currentDateTime');
        if (dateTimeElement) {
            dateTimeElement.textContent = now.toLocaleDateString('fr-FR', options);
        }
        
        // Update every minute
        setTimeout(() => this.updateDateTime(), 60000);
    }

    async loadInitialData() {
        try {
            this.showLoadingOverlay();
            
            // Load reports data
            const response = await fetch('/api/admin/reports', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load reports');
            }
            
            const data = await response.json();
            this.updateDashboardStats(data);
            this.updateReportsTable(data.data || []);
            this.updateActivity();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showToast('Erreur lors du chargement des données', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    updateDashboardStats(data) {
        const stats = this.calculateStats(data.data || []);
        
        // Update stat cards
        document.getElementById('totalReports').textContent = stats.totalReports;
        document.getElementById('totalVehicles').textContent = stats.totalVehicles;
        document.getElementById('totalDrivers').textContent = stats.totalDrivers;
        document.getElementById('totalFuel').textContent = stats.totalFuel;
        
        // Update header stats
        document.getElementById('headerTotalReports').textContent = stats.totalReports;
        document.getElementById('headerTodayReports').textContent = stats.todayReports;
        
        // Update trends
        this.updateTrends(stats);
    }

    calculateStats(reports) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        
        const todayReports = reports.filter(r => new Date(r.date) >= today);
        const lastMonthReports = reports.filter(r => new Date(r.date) >= lastMonth);
        
        const vehicles = new Set();
        const drivers = new Set();
        let totalFuel = 0;
        
        reports.forEach(report => {
            if (report.vehicles) {
                report.vehicles.forEach(vehicle => {
                    if (vehicle.matricule) vehicles.add(vehicle.matricule);
                    if (vehicle.chauffeur) drivers.add(vehicle.chauffeur);
                    totalFuel += vehicle.quantiteLivree || 0;
                });
            }
        });
        
        return {
            totalReports: reports.length,
            todayReports: todayReports.length,
            totalVehicles: vehicles.size,
            totalDrivers: drivers.size,
            totalFuel: totalFuel.toFixed(0),
            lastMonthReports: lastMonthReports.length
        };
    }

    updateTrends(stats) {
        // Calculate trends (simplified for demo)
        const trends = {
            reports: Math.random() * 20 - 10,
            vehicles: Math.random() * 15 - 5,
            drivers: Math.random() * 10 - 5,
            fuel: Math.random() * 25 - 12.5
        };
        
        this.updateTrendElement('reportsChange', trends.reports);
        this.updateTrendElement('vehiclesChange', trends.vehicles);
        this.updateTrendElement('driversChange', trends.drivers);
        this.updateTrendElement('fuelChange', trends.fuel, 'L');
    }

    updateTrendElement(elementId, value, suffix = '%') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const arrow = element.querySelector('.trend-arrow');
        const valueEl = element.querySelector('.trend-value');
        
        if (value > 0) {
            arrow.textContent = '↗';
            arrow.style.color = 'var(--success-color)';
            valueEl.textContent = `+${value.toFixed(1)}${suffix}`;
            valueEl.style.color = 'var(--success-color)';
        } else {
            arrow.textContent = '↘';
            arrow.style.color = 'var(--danger-color)';
            valueEl.textContent = `${value.toFixed(1)}${suffix}`;
            valueEl.style.color = 'var(--danger-color)';
        }
    }

    initializeCharts() {
        // Initialize reports chart
        const reportsCtx = document.getElementById('reportsChart')?.getContext('2d');
        if (reportsCtx) {
            this.charts.reports = new Chart(reportsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Rapports',
                        data: [],
                        borderColor: 'rgb(26, 86, 219)',
                        backgroundColor: 'rgba(26, 86, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)'
                            }
                        }
                    }
                }
            });
            
            this.updateReportsChart();
        }

        // Initialize fuel chart
        const fuelCtx = document.getElementById('fuelChart')?.getContext('2d');
        if (fuelCtx) {
            this.charts.fuel = new Chart(fuelCtx, {
                type: 'bar',
                data: {
                    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                    datasets: [{
                        label: 'Carburant (L)',
                        data: [450, 520, 380, 610, 490, 320, 280],
                        backgroundColor: 'rgba(234, 179, 8, 0.8)',
                        borderColor: 'rgb(234, 179, 8)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        // Initialize depot chart
        const depotCtx = document.getElementById('depotChart')?.getContext('2d');
        if (depotCtx) {
            this.charts.depot = new Chart(depotCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Dépôt A', 'Dépôt B', 'Dépôt C', 'Dépôt D'],
                    datasets: [{
                        data: [30, 25, 20, 25],
                        backgroundColor: [
                            'rgba(26, 86, 219, 0.8)',
                            'rgba(6, 182, 212, 0.8)',
                            'rgba(22, 163, 74, 0.8)',
                            'rgba(234, 179, 8, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }

    updateReportsChart() {
        const period = document.getElementById('periodSelect')?.value || 30;
        const days = parseInt(period);
        
        // Generate sample data
        const labels = [];
        const data = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }));
            data.push(Math.floor(Math.random() * 10) + 1);
        }
        
        if (this.charts.reports) {
            this.charts.reports.data.labels = labels;
            this.charts.reports.data.datasets[0].data = data;
            this.charts.reports.update();
        }
    }

    updateActivity() {
        const activities = [
            {
                icon: 'success',
                text: 'Nouveau rapport créé',
                meta: 'Il y a 2 minutes',
                emoji: '📋'
            },
            {
                icon: 'warning',
                text: 'Synchronisation en cours',
                meta: 'Il y a 5 minutes',
                emoji: '⚠️'
            },
            {
                icon: 'info',
                text: 'Export PDF généré',
                meta: 'Il y a 10 minutes',
                emoji: '📊'
            },
            {
                icon: 'success',
                text: 'Sauvegarde terminée',
                meta: 'Il y a 15 minutes',
                emoji: '💾'
            },
            {
                icon: 'info',
                text: 'Connexion utilisateur',
                meta: 'Il y a 20 minutes',
                emoji: '👤'
            }
        ];
        
        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon ${activity.icon}">${activity.emoji}</div>
                    <div class="activity-content">
                        <div class="activity-text">${activity.text}</div>
                        <div class="activity-meta">${activity.meta}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    showSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById(`${section}-section`).style.display = 'block';
        
        this.currentSection = section;
        
        // Load section-specific data
        if (section === 'analytics') {
            this.refreshAnalytics();
        } else if (section === 'reports') {
            this.refreshReports();
        }
    }

    showSettingsTab(tabName) {
        // Update tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector('.settings-tab.active').classList.add('active');
        
        // Update panels
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}-settings`).classList.add('active');
    }

    updateReportsTable(reports) {
        const tbody = document.getElementById('reportsTableBody');
        if (!tbody) return;
        
        if (reports.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">📝</div>
                            <div class="empty-text">Aucun rapport trouvé</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = reports.map(report => `
            <tr>
                <td>
                    <input type="checkbox" onchange="dashboard.toggleReportSelection('${report.id}')">
                </td>
                <td>${new Date(report.date).toLocaleDateString('fr-FR')}</td>
                <td>${report.vehicles?.[0]?.matricule || 'N/A'}</td>
                <td>${report.vehicles?.[0]?.chauffeur || 'N/A'}</td>
                <td>${report.depot || 'N/A'}</td>
                <td>${this.calculateTotalFuel(report.vehicles)}</td>
                <td>
                    <span class="status-badge status-completed">Complété</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="dashboard.viewReport('${report.id}')">
                            👁️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="dashboard.editReport('${report.id}')">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="dashboard.deleteReport('${report.id}')">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Update info
        document.getElementById('tableInfo').querySelector('.info-count').textContent = 
            `${reports.length} rapport${reports.length > 1 ? 's' : ''} trouvé${reports.length > 1 ? 's' : ''}`;
    }

    calculateTotalFuel(vehicles) {
        if (!vehicles) return '0';
        return vehicles.reduce((total, vehicle) => total + (vehicle.quantiteLivree || 0), 0).toFixed(1);
    }

    toggleReportSelection(reportId) {
        if (this.selectedReports.has(reportId)) {
            this.selectedReports.delete(reportId);
        } else {
            this.selectedReports.add(reportId);
        }
        
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = `${this.selectedReports.size} sélectionné${this.selectedReports.size > 1 ? 's' : ''}`;
        }
    }

    toggleSelectAll() {
        const checkboxes = document.querySelectorAll('#reportsTableBody input[type="checkbox"]');
        const selectAll = document.getElementById('selectAll');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
            const reportId = checkbox.getAttribute('onchange').match(/'([^']+)'/)[1];
            if (selectAll.checked) {
                this.selectedReports.add(reportId);
            } else {
                this.selectedReports.delete(reportId);
            }
        });
        
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = `${this.selectedReports.size} sélectionné${this.selectedReports.size > 1 ? 's' : ''}`;
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-message">${message}</div>
            <div class="toast-meta">${new Date().toLocaleTimeString('fr-FR')}</div>
        `;
        
        const container = document.getElementById('toastContainer');
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

    showLoadingOverlay() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'r':
                    e.preventDefault();
                    this.refreshData();
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput')?.focus();
                    break;
                case 'e':
                    e.preventDefault();
                    this.exportAllReports();
                    break;
            }
        }
    }

    startPeriodicUpdates() {
        // Update activity every 30 seconds
        setInterval(() => {
            this.updateActivity();
        }, 30000);
        
        // Update charts every 5 minutes
        setInterval(() => {
            this.updateReportsChart();
        }, 300000);
    }

    loadSettings() {
        const defaultSettings = {
            language: 'fr',
            dateFormat: 'dd/mm/yyyy',
            timezone: 'Africa/Casablanca',
            autoBackup: 'daily',
            dataRetention: '2',
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            sessionDuration: '8',
            twoFactorAuth: 'disabled'
        };
        
        try {
            const stored = localStorage.getItem('adminSettings');
            return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
        } catch (e) {
            return defaultSettings;
        }
    }

    saveSettings() {
        const settings = {};
        
        // Collect all settings
        settings.language = document.getElementById('interfaceLanguage')?.value;
        settings.dateFormat = document.getElementById('dateFormat')?.value;
        settings.timezone = document.getElementById('timezone')?.value;
        settings.autoBackup = document.getElementById('autoBackup')?.value;
        settings.dataRetention = document.getElementById('dataRetention')?.value;
        settings.emailNotifications = document.getElementById('emailNotifications')?.checked;
        settings.pushNotifications = document.getElementById('pushNotifications')?.checked;
        settings.smsNotifications = document.getElementById('smsNotifications')?.checked;
        settings.sessionDuration = document.getElementById('sessionDuration')?.value;
        settings.twoFactorAuth = document.getElementById('twoFactorAuth')?.value;
        
        try {
            localStorage.setItem('adminSettings', JSON.stringify(settings));
            this.settings = settings;
            this.showToast('Paramètres sauvegardés avec succès', 'success');
        } catch (e) {
            this.showToast('Erreur lors de la sauvegarde des paramètres', 'error');
        }
    }

    // Placeholder methods for actions
    refreshData() {
        this.showLoadingOverlay();
        this.loadInitialData();
        this.showToast('Données actualisées', 'success');
    }

    refreshReports() {
        this.loadInitialData();
    }

    refreshAnalytics() {
        // Refresh analytics charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.update();
        });
    }

    refreshActivity() {
        this.updateActivity();
    }

    exportAllReports() {
        this.showToast('Export en cours...', 'info');
        // Implementation for export
    }

    showDailyExport() {
        document.getElementById('dailyExportModal').style.display = 'block';
    }

    showAnalytics() {
        this.showSection('analytics');
    }

    showBackup() {
        this.showToast('Sauvegarde initiée', 'info');
    }

    applyFilters() {
        this.showToast('Filtres appliqués', 'success');
    }

    searchReports(query) {
        console.log('Searching for:', query);
    }

    viewReport(id) {
        console.log('View report:', id);
    }

    editReport(id) {
        console.log('Edit report:', id);
    }

    deleteReport(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
            console.log('Delete report:', id);
        }
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    logout() {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            localStorage.removeItem('adminToken');
            window.location.href = '/login.html';
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new EnhancedAdminDashboard();
});

// Global functions for inline event handlers
function showSection(section) {
    window.dashboard.showSection(section);
}

function toggleSelectAll() {
    window.dashboard.toggleSelectAll();
}

function logout() {
    window.dashboard.logout();
}

function refreshData() {
    window.dashboard.refreshData();
}

function exportAllReports() {
    window.dashboard.exportAllReports();
}

function showDailyExport() {
    window.dashboard.showDailyExport();
}

function showAnalytics() {
    window.dashboard.showAnalytics();
}

function showBackup() {
    window.dashboard.showBackup();
}

function applyFilters() {
    window.dashboard.applyFilters();
}

function refreshReports() {
    window.dashboard.refreshReports();
}

function refreshAnalytics() {
    window.dashboard.refreshAnalytics();
}

function refreshActivity() {
    window.dashboard.refreshActivity();
}

function saveSettings() {
    window.dashboard.saveSettings();
}

function resetSettings() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les paramètres ?')) {
        localStorage.removeItem('adminSettings');
        location.reload();
    }
}

function showSettingsTab(tab) {
    window.dashboard.showSettingsTab(tab);
}

function closeModal() {
    window.dashboard.closeModal();
}