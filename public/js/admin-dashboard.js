class AdminDashboard {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSort = { field: 'date', direction: 'desc' };
        this.reports = [];
        this.filteredReports = [];
        this.selectedReports = new Set();
        
        this.init();
    }
    
    async init() {
        await this.checkAuth();
        this.initializeEventListeners();
        await this.loadDashboardData();
        this.setupPeriodicRefresh();
    }
    
    async checkAuth() {
        const token = localStorage.getItem('adminToken');
        const expiry = localStorage.getItem('tokenExpiry');
        
        if (!token || !expiry || new Date().getTime() > parseInt(expiry)) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const response = await fetch('/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Token invalid');
            }
            
            const userData = JSON.parse(localStorage.getItem('adminUser'));
            document.getElementById('welcomeUser').textContent = `Bienvenue, ${userData.name}`;
        } catch (error) {
            console.error('Auth error:', error);
            this.logout();
        }
    }
    
    initializeEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const section = link.dataset.section;
                if (section) {
                    e.preventDefault();
                    this.showSection(section);
                }
                // Les liens sans data-section (comme backup-manager.html) naviguent normalement
            });
        });
        
        document.getElementById('searchInput').addEventListener('input', 
            this.debounce(() => this.searchReports(), 300)
        );
        
        ['dateFilter', 'vehicleFilter', 'statusFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.applyFilters());
        });
        
        document.getElementById('reportModal').addEventListener('click', (e) => {
            if (e.target.id === 'reportModal') {
                this.closeModal();
            }
        });
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
    
    showSection(section) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
        document.getElementById(`${section}-section`).style.display = 'block';
    }
    
    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('adminToken');
            const [statsResponse, reportsResponse] = await Promise.all([
                fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/reports', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (!statsResponse.ok || !reportsResponse.ok) {
                throw new Error('Failed to load data');
            }
            
            const statsData = await statsResponse.json();
            const reportsData = await reportsResponse.json();
            
            this.updateStats(statsData.stats || {});
            this.reports = reportsData.reports || [];
            this.filteredReports = [...this.reports];
            
            this.updateReportsTable();
            this.updateVehicleFilter();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Erreur lors du chargement des données', 'error');
            this.reports = [];
            this.filteredReports = [];
            this.updateStats({});
            this.updateReportsTable();
        } finally {
            this.showLoading(false);
        }
    }
    
    updateStats(stats) {
        document.getElementById('totalReports').textContent = stats.totalReports || 0;
        document.getElementById('totalVehicles').textContent = stats.totalVehicles || 0;
        document.getElementById('totalDrivers').textContent = stats.totalDrivers || 0;
        document.getElementById('totalFuel').textContent = `${stats.totalFuel || 0}L`;
        
        document.getElementById('reportsChange').textContent = '+12% ce mois';
        document.getElementById('vehiclesChange').textContent = '+5% ce mois';
        document.getElementById('driversChange').textContent = '+8% ce mois';
        document.getElementById('fuelChange').textContent = 'Total ce mois';
    }
    
    updateReportsTable() {
        const tbody = document.getElementById('reportsTableBody');
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageReports = this.filteredReports.slice(start, end);
        
        if (pageReports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #666;">Aucun rapport trouvé</td></tr>';
            document.getElementById('tableInfo').textContent = '0 rapports trouvés';
            return;
        }
        
        tbody.innerHTML = pageReports.map(report => {
            const totalFuel = report.vehicles ? 
                report.vehicles.reduce((sum, v) => sum + (v.quantiteLivree || 0), 0) : 0;
            const driversCount = report.vehicles ? report.vehicles.length : 0;
            const status = this.getReportStatus(report);
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" value="${report.id}" 
                               ${this.selectedReports.has(report.id) ? 'checked' : ''}
                               onchange="dashboard.toggleReportSelection('${report.id}')">
                    </td>
                    <td>${new Date(report.date).toLocaleDateString('fr-FR')}</td>
                    <td>${report.vehicles && report.vehicles[0] ? report.vehicles[0].matricule : 'N/A'}</td>
                    <td>${report.depot || 'N/A'}</td>
                    <td>${report.chantier || 'N/A'}</td>
                    <td>${totalFuel.toFixed(1)}L</td>
                    <td>${driversCount}</td>
                    <td><span class="status-badge status-${status.class}">${status.text}</span></td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="dashboard.viewReport('${report.id}')">
                            👁️ Voir
                        </button>
                        <button class="btn btn-sm btn-success" onclick="dashboard.exportSingleReport('${report.id}')">
                            📄 PDF
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('tableInfo').textContent = 
            `${this.filteredReports.length} rapports trouvés`;
        
        this.updatePagination();
    }
    
    getReportStatus(report) {
        if (report.vehicles && report.vehicles.length > 0 && 
            report.signatureResponsable && report.signatureChef) {
            return { class: 'completed', text: 'Complété' };
        } else if (report.vehicles && report.vehicles.length > 0) {
            return { class: 'pending', text: 'En attente' };
        } else {
            return { class: 'cancelled', text: 'Incomplet' };
        }
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = `
            <button ${this.currentPage === 1 ? 'disabled' : ''} 
                    onclick="dashboard.goToPage(${this.currentPage - 1})">
                ← Précédent
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || 
                (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <button class="${i === this.currentPage ? 'active' : ''}"
                            onclick="dashboard.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span>...</span>';
            }
        }
        
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick="dashboard.goToPage(${this.currentPage + 1})">
                Suivant →
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }
    
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredReports.length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.updateReportsTable();
        }
    }
    
    searchReports() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        
        if (!query) {
            this.filteredReports = [...this.reports];
        } else {
            this.filteredReports = this.reports.filter(report => {
                return (
                    (report.depot && report.depot.toLowerCase().includes(query)) ||
                    (report.chantier && report.chantier.toLowerCase().includes(query)) ||
                    (report.vehicles && report.vehicles.some(v => 
                        v.matricule && v.matricule.toLowerCase().includes(query) ||
                        v.chauffeur && v.chauffeur.toLowerCase().includes(query)
                    )) ||
                    new Date(report.date).toLocaleDateString('fr-FR').includes(query)
                );
            });
        }
        
        this.currentPage = 1;
        this.updateReportsTable();
    }
    
    applyFilters() {
        const dateFilter = document.getElementById('dateFilter').value;
        const vehicleFilter = document.getElementById('vehicleFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        
        this.filteredReports = this.reports.filter(report => {
            let passes = true;
            
            if (dateFilter) {
                const reportDate = new Date(report.date).toISOString().split('T')[0];
                passes = passes && (reportDate === dateFilter);
            }
            
            if (vehicleFilter) {
                passes = passes && report.vehicles && 
                    report.vehicles.some(v => v.matricule === vehicleFilter);
            }
            
            if (statusFilter) {
                const status = this.getReportStatus(report);
                passes = passes && (status.class === statusFilter);
            }
            
            return passes;
        });
        
        this.currentPage = 1;
        this.updateReportsTable();
    }
    
    toggleSelectAll() {
        const selectAll = document.getElementById('selectAll');
        const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
        
        if (selectAll.checked) {
            checkboxes.forEach(cb => {
                cb.checked = true;
                this.selectedReports.add(cb.value);
            });
        } else {
            checkboxes.forEach(cb => {
                cb.checked = false;
                this.selectedReports.delete(cb.value);
            });
        }
    }
    
    toggleReportSelection(reportId) {
        if (this.selectedReports.has(reportId)) {
            this.selectedReports.delete(reportId);
        } else {
            this.selectedReports.add(reportId);
        }
        
        const allCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
        const checkedCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]:checked');
        const selectAll = document.getElementById('selectAll');
        
        selectAll.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;
        selectAll.checked = checkedCheckboxes.length === allCheckboxes.length && allCheckboxes.length > 0;
    }
    
    async viewReport(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) return;
        
        const modalBody = document.getElementById('modalBody');
        const totalFuel = report.vehicles ? 
            report.vehicles.reduce((sum, v) => sum + (v.quantiteLivree || 0), 0) : 0;
        
        modalBody.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h4>Informations Générales</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
                    <div><strong>Date:</strong> ${new Date(report.date).toLocaleDateString('fr-FR')}</div>
                    <div><strong>Dépôt:</strong> ${report.depot || 'N/A'}</div>
                    <div><strong>Chantier:</strong> ${report.chantier || 'N/A'}</div>
                    <div><strong>Entrée:</strong> ${report.entree || 'N/A'}</div>
                    <div><strong>Origine:</strong> ${report.origine || 'N/A'}</div>
                    <div><strong>Stock Début:</strong> ${report.stockDebut || 0}L</div>
                    <div><strong>Stock Fin:</strong> ${report.stockFin || 0}L</div>
                    <div><strong>Sortie Gasoil:</strong> ${report.sortieGasoil || 0}L</div>
                </div>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4>Véhicules et Conducteurs</h4>
                ${report.vehicles && report.vehicles.length > 0 ? `
                    <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.5rem; border: 1px solid #dee2e6;">Matricule</th>
                                <th style="padding: 0.5rem; border: 1px solid #dee2e6;">Chauffeur</th>
                                <th style="padding: 0.5rem; border: 1px solid #dee2e6;">Heure</th>
                                <th style="padding: 0.5rem; border: 1px solid #dee2e6;">Quantité</th>
                                <th style="padding: 0.5rem; border: 1px solid #dee2e6;">Lieu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.vehicles.map(vehicle => `
                                <tr>
                                    <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${vehicle.matricule || 'N/A'}</td>
                                    <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${vehicle.chauffeur || 'N/A'}</td>
                                    <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${vehicle.heureRevif || 'N/A'}</td>
                                    <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${vehicle.quantiteLivree || 0}L</td>
                                    <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${vehicle.lieuComptage || 'N/A'}</td>
                                </tr>
                            `).join('')}
                            <tr style="background: #e9ecef; font-weight: bold;">
                                <td colspan="3" style="padding: 0.5rem; border: 1px solid #dee2e6;">Total</td>
                                <td style="padding: 0.5rem; border: 1px solid #dee2e6;">${totalFuel.toFixed(1)}L</td>
                                <td style="padding: 0.5rem; border: 1px solid #dee2e6;">-</td>
                            </tr>
                        </tbody>
                    </table>
                ` : '<p>Aucun véhicule enregistré</p>'}
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4>Signatures</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <strong>Signature Responsable:</strong>
                        ${report.signatureUrlResponsable ? 
                            `<img src="${report.signatureUrlResponsable}" style="max-width: 200px; border: 1px solid #ddd; margin-top: 0.5rem;">` :
                            '<p>Aucune signature</p>'
                        }
                    </div>
                    <div>
                        <strong>Signature Chef:</strong>
                        ${report.signatureUrlChef ? 
                            `<img src="${report.signatureUrlChef}" style="max-width: 200px; border: 1px solid #ddd; margin-top: 0.5rem;">` :
                            '<p>Aucune signature</p>'
                        }
                    </div>
                </div>
            </div>
            
            <div style="text-align: right; margin-top: 2rem;">
                <button class="btn btn-success" onclick="dashboard.exportSingleReport('${reportId}')">
                    📄 Exporter en PDF
                </button>
                <button class="btn btn-primary" onclick="dashboard.closeModal()">
                    Fermer
                </button>
            </div>
        `;
        
        document.getElementById('reportModal').style.display = 'block';
    }
    
    closeModal() {
        document.getElementById('reportModal').style.display = 'none';
    }
    
    async exportSingleReport(reportId) {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch(`/api/admin/reports/${reportId}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapport_${reportId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Rapport exporté avec succès', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Erreur lors de l\'export', 'error');
        }
    }
    
    updateVehicleFilter() {
        const select = document.getElementById('vehicleFilter');
        const vehicles = new Set();
        
        this.reports.forEach(report => {
            if (report.vehicles) {
                report.vehicles.forEach(vehicle => {
                    if (vehicle.matricule) {
                        vehicles.add(vehicle.matricule);
                    }
                });
            }
        });
        
        select.innerHTML = '<option value="">Tous les véhicules</option>';
        Array.from(vehicles).sort().forEach(vehicle => {
            select.innerHTML += `<option value="${vehicle}">${vehicle}</option>`;
        });
    }
    
    async refreshData() {
        await this.loadDashboardData();
        this.showToast('Données actualisées', 'success');
    }
    
    async refreshReports() {
        await this.loadDashboardData();
        this.showToast('Liste des rapports actualisée', 'success');
    }
    
    async exportAllReports() {
        if (this.reports.length === 0) {
            this.showToast('Aucun rapport à exporter', 'warning');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/reports/export/all', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapports_complets_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Tous les rapports exportés avec succès', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Erreur lors de l\'export global', 'error');
        }
    }
    
    async exportSelectedReports() {
        if (this.selectedReports.size === 0) {
            this.showToast('Veuillez sélectionner au moins un rapport', 'warning');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/reports/export/selected', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportIds: Array.from(this.selectedReports)
                })
            });
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rapports_selection_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast(`${this.selectedReports.size} rapports exportés avec succès`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showToast('Erreur lors de l\'export de la sélection', 'error');
        }
    }
    
    exportToCSV() {
        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapports_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        this.showToast('Export CSV terminé', 'success');
        this.toggleExportMenu();
    }
    
    generateCSV() {
        const headers = ['Date', 'Véhicule', 'Dépôt', 'Chantier', 'Carburant (L)', 'Conducteurs'];
        const rows = this.filteredReports.map(report => {
            const totalFuel = report.vehicles ? 
                report.vehicles.reduce((sum, v) => sum + (v.quantiteLivree || 0), 0) : 0;
            const vehicle = report.vehicles && report.vehicles[0] ? report.vehicles[0].matricule : 'N/A';
            const driversCount = report.vehicles ? report.vehicles.length : 0;
            
            return [
                new Date(report.date).toLocaleDateString('fr-FR'),
                vehicle,
                report.depot || 'N/A',
                report.chantier || 'N/A',
                totalFuel.toFixed(1),
                driversCount
            ];
        });
        
        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }
    
    toggleExportMenu() {
        const dropdown = document.getElementById('exportDropdown');
        dropdown.classList.toggle('show');
    }
    
    showBackup() {
        this.showToast('Fonctionnalité de sauvegarde en cours de développement', 'info');
    }
    
    // === FONCTIONNALITÉS D'EXPORT JOURNALIER ===
    showDailyExport() {
        const modal = document.getElementById('dailyExportModal');
        const dateInput = document.getElementById('dailyExportDate');
        const today = new Date().toISOString().split('T')[0];
        
        // Définir la date par défaut sur aujourd'hui
        dateInput.value = today;
        
        // Réinitialiser l'interface
        this.resetDailyExportModal();
        
        // Afficher le modal
        modal.style.display = 'block';
        
        // Événement pour détecter le changement de date
        dateInput.addEventListener('change', () => {
            this.previewDailyReports();
        });
        
        // Prévisualiser automatiquement la date d'aujourd'hui
        this.previewDailyReports();
    }
    
    closeDailyExportModal() {
        const modal = document.getElementById('dailyExportModal');
        modal.style.display = 'none';
        this.resetDailyExportModal();
    }
    
    resetDailyExportModal() {
        const info = document.getElementById('dailyExportInfo');
        const exportBtn = document.getElementById('exportBtn');
        
        info.className = 'export-info';
        info.innerHTML = '<p>Sélectionnez une date pour voir les rapports disponibles.</p>';
        exportBtn.disabled = true;
        
        // Supprimer les aperçus précédents
        const existingPreview = document.querySelector('.report-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }
    
    async previewDailyReports() {
        const dateInput = document.getElementById('dailyExportDate');
        const selectedDate = dateInput.value;
        
        if (!selectedDate) {
            this.resetDailyExportModal();
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/reports', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erreur lors de la récupération des rapports');
            }
            
            const data = await response.json();
            
            // Filtrer les rapports par date
            const targetDate = new Date(selectedDate);
            const dailyReports = data.reports.filter(report => {
                const reportDate = new Date(report.date);
                return reportDate.toDateString() === targetDate.toDateString();
            });
            
            this.displayDailyReportsPreview(dailyReports, selectedDate);
            
        } catch (error) {
            console.error('Erreur preview:', error);
            this.showToast('Erreur lors de la prévisualisation', 'error');
        }
    }
    
    displayDailyReportsPreview(reports, date) {
        const info = document.getElementById('dailyExportInfo');
        const exportBtn = document.getElementById('exportBtn');
        const formattedDate = new Date(date).toLocaleDateString('fr-FR');
        
        // Supprimer l'ancien aperçu
        const existingPreview = document.querySelector('.report-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
        
        if (reports.length === 0) {
            info.className = 'export-info no-reports';
            info.innerHTML = `
                <p class="no-report-message">
                    Aucun rapport trouvé pour le ${formattedDate}
                </p>
            `;
            exportBtn.disabled = true;
            return;
        }
        
        // Calculer les statistiques
        const totalFuel = reports.reduce((sum, report) => sum + (report.sortieGasoil || 0), 0);
        const totalVehicles = reports.reduce((sum, report) => sum + (report.vehicles?.length || 0), 0);
        const depots = [...new Set(reports.map(r => r.depot))].filter(Boolean);
        
        info.className = 'export-info has-reports';
        info.innerHTML = `
            <p>
                <span class="report-count">${reports.length} rapport(s)</span> 
                trouvé(s) pour le ${formattedDate}
            </p>
            <p>• ${totalFuel.toFixed(1)} L de carburant distribué</p>
            <p>• ${totalVehicles} véhicule(s) servi(s)</p>
            <p>• ${depots.length} dépôt(s) concerné(s)</p>
            <p><strong>📋 Tous les rapports seront regroupés sur une seule page avec numérotation continue</strong></p>
        `;
        
        // Créer l'aperçu détaillé
        const preview = document.createElement('div');
        preview.className = 'report-preview';
        
        reports.forEach(report => {
            const item = document.createElement('div');
            item.className = 'report-preview-item';
            
            const time = new Date(report.submittedAt).toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            item.innerHTML = `
                <div class="report-preview-time">${time}</div>
                <div class="report-preview-info">
                    <div class="report-preview-depot">${report.depot || 'N/A'}</div>
                    <div class="report-preview-details">
                        ${report.chantier || 'N/A'} • ${report.vehicles?.length || 0} véhicule(s) • ${(report.sortieGasoil || 0).toFixed(1)} L
                    </div>
                </div>
            `;
            
            preview.appendChild(item);
        });
        
        info.appendChild(preview);
        exportBtn.disabled = false;
    }
    
    async exportDailyReports() {
        const dateInput = document.getElementById('dailyExportDate');
        const selectedDate = dateInput.value;
        
        if (!selectedDate) {
            this.showToast('Veuillez sélectionner une date', 'warning');
            return;
        }
        
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch('/api/admin/reports/export/daily', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date: selectedDate })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de l\'export');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const formattedDate = new Date(selectedDate).toLocaleDateString('fr-FR').replace(/\//g, '-');
            a.download = `Rapports_Journaliers_${formattedDate}.pdf`;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Export journalier réussi', 'success');
            this.closeDailyExportModal();
            
        } catch (error) {
            console.error('Erreur export journalier:', error);
            this.showToast(error.message || 'Erreur lors de l\'export journalier', 'error');
        }
    }
    
    saveSettings() {
        this.showToast('Paramètres sauvegardés', 'success');
    }
    
    setupPeriodicRefresh() {
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }
    
    showLoading(show) {
        const tbody = document.getElementById('reportsTableBody');
        if (show) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">Chargement des données...</td></tr>';
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${this.getToastTitle(type)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
    
    getToastTitle(type) {
        switch (type) {
            case 'success': return 'Succès';
            case 'error': return 'Erreur';
            case 'warning': return 'Attention';
            default: return 'Information';
        }
    }
    
    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('adminUser');
        window.location.href = '/login.html';
    }
}

// Global functions for HTML onclick handlers
window.dashboard = null;

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});

// Global function implementations
function showSection(section) {
    if (window.dashboard) {
        window.dashboard.showSection(section);
    }
}

function showDailyExport() {
    if (window.dashboard) {
        window.dashboard.showDailyExport();
    }
}

function closeDailyExportModal() {
    if (window.dashboard) {
        window.dashboard.closeDailyExportModal();
    }
}

function previewDailyReports() {
    if (window.dashboard) {
        window.dashboard.previewDailyReports();
    }
}

function exportDailyReports() {
    if (window.dashboard) {
        window.dashboard.exportDailyReports();
    }
}

function logout() {
    if (window.dashboard) {
        window.dashboard.logout();
    }
}

function refreshData() {
    if (window.dashboard) {
        window.dashboard.refreshData();
    }
}

function exportAllReports() {
    if (window.dashboard) {
        window.dashboard.exportAllReports();
    }
}

function showBackup() {
    if (window.dashboard) {
        window.dashboard.showBackup();
    }
}

function applyFilters() {
    if (window.dashboard) {
        window.dashboard.applyFilters();
    }
}

function exportSelectedReports() {
    if (window.dashboard) {
        window.dashboard.exportSelectedReports();
    }
}

function toggleExportMenu() {
    if (window.dashboard) {
        window.dashboard.toggleExportMenu();
    }
}

function exportToCSV() {
    if (window.dashboard) {
        window.dashboard.exportToCSV();
    }
}

function refreshReports() {
    if (window.dashboard) {
        window.dashboard.refreshReports();
    }
}

function searchReports() {
    if (window.dashboard) {
        window.dashboard.searchReports();
    }
}

function toggleSelectAll() {
    if (window.dashboard) {
        window.dashboard.toggleSelectAll();
    }
}

function closeModal() {
    if (window.dashboard) {
        window.dashboard.closeModal();
    }
}

function saveSettings() {
    if (window.dashboard) {
        window.dashboard.saveSettings();
    }
}

// Close export dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-menu')) {
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }
});