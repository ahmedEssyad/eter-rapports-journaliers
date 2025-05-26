                class AdminDashboard {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSort = { field: 'date', direction: 'desc' };
        this.reports = [];
        this.filteredReports = [];
        this.selectedReports = new Set();
        this.charts = {};
        
        this.init();
    }
    
    async init() {
        // Check authentication
        await this.checkAuth();
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Set up periodic refresh
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
                headers: {
                    'Authorization': `Bearer ${token}`
                }
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
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });
        
        // Search input
        document.getElementById('searchInput').addEventListener('input', 
            this.debounce(() => this.searchReports(), 300)
        );
        
        // Filters
        ['dateFilter', 'vehicleFilter', 'statusFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.applyFilters());
        });
        
        // Modal close on outside click
        document.getElementById('reportModal').addEventListener('click', (e) => {
            if (e.target.id === 'reportModal') {
                this.closeModal();
            }
        });
    }
    
    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            const token = localStorage.getItem('adminToken');
            const [statsResponse, reportsResponse] = await Promise.all([
                fetch('/api/admin/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/admin/reports', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            
            if (!statsResponse.ok || !reportsResponse.ok) {
                throw new Error('Failed to load data');
            }
            
            const statsData = await statsResponse.json();
            const reportsData = await reportsResponse.json();
            
            this.updateStats(statsData.stats);
            this.reports = reportsData.reports || [];
            this.filteredReports = [...this.reports];
            
            this.updateReportsTable();
            this.updateVehicleFilter();
            this.updateCharts();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Erreur lors du chargement des données', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    updateStats(stats) {
        document.getElementById('totalReports').textContent = stats.totalReports || 0;
        document.getElementById('totalVehicles').textContent = stats.totalVehicles || 0;
        document.getElementById('totalDrivers').textContent = stats.totalDrivers || 0;
        document.getElementById('totalFuel').textContent = `${stats.totalFuel || 0}L`;
        
        // Update changes (mock data for demo)
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
            tbody.innerHTML = '<tr><td colspan=\"9\" style=\"text-align: center; padding: 2rem; color: #666;\">Aucun rapport trouvé</td></tr>';
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
                        <input type=\"checkbox\" value=\"${report.id}\" 
                               ${this.selectedReports.has(report.id) ? 'checked' : ''}
                               onchange=\"dashboard.toggleReportSelection('${report.id}')\">
                    </td>
                    <td>${new Date(report.date).toLocaleDateString('fr-FR')}</td>
                    <td>${report.vehicles && report.vehicles[0] ? report.vehicles[0].matricule : 'N/A'}</td>
                    <td>${report.depot || 'N/A'}</td>
                    <td>${report.chantier || 'N/A'}</td>
                    <td>${totalFuel.toFixed(1)}L</td>
                    <td>${driversCount}</td>
                    <td><span class=\"status-badge status-${status.class}\">${status.text}</span></td>
                    <td>
                        <button class=\"btn btn-sm btn-info\" onclick=\"dashboard.viewReport('${report.id}')\">
                            👁️ Voir
                        </button>
                        <button class=\"btn btn-sm btn-success\" onclick=\"dashboard.exportSingleReport('${report.id}')\">
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
        // Simple status logic based on data completeness
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
                    onclick=\"dashboard.goToPage(${this.currentPage - 1})\">
                ← Précédent
            </button>
        `;
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || 
                (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `
                    <button class=\"${i === this.currentPage ? 'active' : ''}\"
                            onclick=\"dashboard.goToPage(${i})\">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span>...</span>';
            }
        }
        
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} 
                    onclick=\"dashboard.goToPage(${this.currentPage + 1})\">
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
    
    sortTable(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }
        
        this.filteredReports.sort((a, b) => {
            let aVal, bVal;
            
            switch (field) {
                case 'date':
                    aVal = new Date(a.date);
                    bVal = new Date(b.date);
                    break;
                case 'vehicleId':
                    aVal = a.vehicles && a.vehicles[0] ? a.vehicles[0].matricule : '';
                    bVal = b.vehicles && b.vehicles[0] ? b.vehicles[0].matricule : '';
                    break;
                case 'depot':
                    aVal = a.depot || '';
                    bVal = b.depot || '';
                    break;
                case 'chantier':
                    aVal = a.chantier || '';
                    bVal = b.chantier || '';
                    break;
                case 'totalFuel':
                    aVal = a.vehicles ? a.vehicles.reduce((sum, v) => sum + (v.quantiteLivree || 0), 0) : 0;
                    bVal = b.vehicles ? b.vehicles.reduce((sum, v) => sum + (v.quantiteLivree || 0), 0) : 0;
                    break;
                case 'driversCount':
                    aVal = a.vehicles ? a.vehicles.length : 0;
                    bVal = b.vehicles ? b.vehicles.length : 0;
                    break;
                default:
                    aVal = a[field] || '';
                    bVal = b[field] || '';
            }
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (this.currentSort.direction === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
        
        // Update sort indicators
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
        });
        
        const currentTh = document.querySelector(`[onclick="dashboard.sortTable('${field}')"]`);
        if (currentTh) {
            currentTh.classList.add(this.currentSort.direction);
        }
        
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
        
        // Update select all checkbox
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
    
    exportToExcel() {
        this.showToast('Export Excel en cours de développement', 'info');
        this.toggleExportMenu();
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
    
    initializeCharts() {
        // Fuel Chart
        const fuelCtx = document.getElementById('fuelChart').getContext('2d');
        this.charts.fuel = new Chart(fuelCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Consommation (L)',
                    data: [],
                    backgroundColor: 'rgba(39, 174, 96, 0.8)',
                    borderColor: '#27ae60',
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
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Depot Chart
        const depotCtx = document.getElementById('depotChart').getContext('2d');
        this.charts.depot = new Chart(depotCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3498db',
                        '#e74c3c',
                        '#f39c12',
                        '#27ae60',
                        '#9b59b6',
                        '#1abc9c'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    updateCharts() {
        this.updateFuelChart();
        this.updateDepotChart();
    }
    
    
    updateFuelChart() {
        const vehicleFuel = {};
        
        this.reports.forEach(report => {
            if (report.vehicles) {
                report.vehicles.forEach(vehicle => {
                    if (vehicle.matricule) {
                        vehicleFuel[vehicle.matricule] = 
                            (vehicleFuel[vehicle.matricule] || 0) + (vehicle.quantiteLivree || 0);
                    }
                });
            }
        });
        
        const sortedVehicles = Object.entries(vehicleFuel)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        this.charts.fuel.data.labels = sortedVehicles.map(([vehicle]) => vehicle);
        this.charts.fuel.data.datasets[0].data = sortedVehicles.map(([,fuel]) => fuel);
        this.charts.fuel.update();
    }
    
    updateDepotChart() {
        const depotCounts = {};
        
        this.reports.forEach(report => {
            const depot = report.depot || 'Non spécifié';
            depotCounts[depot] = (depotCounts[depot] || 0) + 1;
        });
        
        const sortedDepots = Object.entries(depotCounts)
            .sort(([,a], [,b]) => b - a);
        
        this.charts.depot.data.labels = sortedDepots.map(([depot]) => depot);
        this.charts.depot.data.datasets[0].data = sortedDepots.map(([,count]) => count);
        this.charts.depot.update();
    }
    
    showSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Show/hide sections
        document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
        document.getElementById(`${section}-section`).style.display = 'block';
        
        // Load section-specific data
        if (section === 'analytics') {
            this.updateCharts();
        }
    }
    
    async refreshData() {
        await this.loadDashboardData();
        this.showToast('Données actualisées', 'success');
    }
    
    async refreshReports() {
        await this.loadDashboardData();
        this.showToast('Liste des rapports actualisée', 'success');
    }
    
    showBackup() {
        this.showToast('Fonctionnalité de sauvegarde en cours de développement', 'info');
    }
    
    saveSettings() {
        this.showToast('Paramètres sauvegardés', 'success');
    }
    
    setupPeriodicRefresh() {
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000); // Refresh every 5 minutes
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

function exportToExcel() {
    if (window.dashboard) {
        window.dashboard.exportToExcel();
    }
}

function exportToCSV() {
    if (window.dashboard) {
        window.dashboard.exportToCSV();
    }
}

function exportToPDF() {
    if (window.dashboard) {
        window.dashboard.exportAllReports();
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

function sortTable(field) {
    if (window.dashboard) {
        window.dashboard.sortTable(field);
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