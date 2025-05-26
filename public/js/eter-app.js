    async saveForm() {
        console.log('💾 Sauvegarde du formulaire...');
        
        try {
            const data = this.collectFormData();
            data.id = 'eter_' + Date.now();
            
            // Sauvegarder dans localStorage
            const savedForms = JSON.parse(localStorage.getItem('eterForms') || '[]');
            savedForms.push(data);
            localStorage.setItem('eterForms', JSON.stringify(savedForms));
            
            // Essayer de sauvegarder sur le serveur
            if (navigator.onLine) {
                try {
                    const response = await fetch('/api/forms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    if (response.ok) {
                        this.showNotification('💾 Formulaire sauvegardé avec succès!', 'success');
                    } else {
                        throw new Error('Erreur serveur');
                    }
                } catch (error) {
                    this.showNotification('⚠️ Sauvegardé localement (hors ligne)', 'warning');
                }
            } else {
                this.showNotification('📱 Sauvegardé localement (mode hors ligne)', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);
            this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
        }
    }

    resetForm() {
        if (confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ?')) {
            document.getElementById('eterForm').reset();
            
            // Réinitialiser les signatures
            this.clearSignature('signaturePompiste');
            this.clearSignature('signatureResponsable');
            
            // Réinitialiser le tableau (garder une ligne)
            const tbody = document.getElementById('vehicleTableBody');
            tbody.innerHTML = `
                <tr>
                    <td><input type="text" name="matricule[]" class="input" style="width: 100%; border: none; background: transparent;"></td>
                    <td><input type="text" name="chauffeur[]" class="input" style="width: 100%; border: none; background: transparent;"></td>
                    <td>
                        <canvas width="80" height="40" class="signature-mini" 
                                style="border: 1px solid #ccc; cursor: pointer;"
                                onclick="eterApp.openSignatureModal(this)"></canvas>
                    </td>
                    <td><input type="time" name="heureRevif[]" class="input" style="width: 100%; border: none; background: transparent;"></td>
                    <td><input type="number" name="qteLivree[]" class="input" style="width: 100%; border: none; background: transparent;"></td>
                    <td><input type="text" name="lieuComptage[]" class="input" style="width: 100%; border: none; background: transparent;"></td>
                    <td><button type="button" onclick="eterApp.removeRow(this)" class="btn btn-danger btn-sm">✕</button></td>
                </tr>
            `;
            
            this.vehicleCount = 1;
            this.updateTotal();
            
            // Remettre la date d'aujourd'hui
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            
            this.showNotification('🔄 Formulaire réinitialisé', 'info');
            console.log('🔄 Formulaire réinitialisé');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 350px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Suppression automatique
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Méthodes pour charger des données sauvegardées
    loadSavedForms() {
        const savedForms = JSON.parse(localStorage.getItem('eterForms') || '[]');
        return savedForms;
    }

    loadForm(formId) {
        const savedForms = this.loadSavedForms();
        const form = savedForms.find(f => f.id === formId);
        
        if (form) {
            // Charger les données du formulaire
            Object.keys(form).forEach(key => {
                const input = document.querySelector(`[name="${key}"]`);
                if (input) {
                    input.value = form[key];
                }
            });
            
            // Charger les véhicules
            if (form.vehicules && form.vehicules.length > 0) {
                // Vider le tableau existant
                const tbody = document.getElementById('vehicleTableBody');
                tbody.innerHTML = '';
                
                // Ajouter chaque véhicule
                form.vehicules.forEach(vehicule => {
                    this.addVehicleRow();
                    const lastRow = tbody.lastElementChild;
                    
                    lastRow.querySelector('input[name="matricule[]"]').value = vehicule.matricule || '';
                    lastRow.querySelector('input[name="chauffeur[]"]').value = vehicule.chauffeur || '';
                    lastRow.querySelector('input[name="heureRevif[]"]').value = vehicule.heureRevif || '';
                    lastRow.querySelector('input[name="qteLivree[]"]').value = vehicule.qteLivree || '';
                    lastRow.querySelector('input[name="lieuComptage[]"]').value = vehicule.lieuComptage || '';
                    
                    // Charger la signature si elle existe
                    if (vehicule.signature) {
                        const canvas = lastRow.querySelector('.signature-mini');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.src = vehicule.signature;
                    }
                });
            }
            
            // Charger les signatures
            if (form.signaturePompiste) {
                this.loadSignatureToCanvas('signaturePompiste', form.signaturePompiste);
            }
            
            if (form.signatureResponsable) {
                this.loadSignatureToCanvas('signatureResponsable', form.signatureResponsable);
            }
            
            this.updateTotal();
            this.showNotification('📄 Formulaire chargé avec succès', 'success');
        }
    }

    loadSignatureToCanvas(canvasId, signatureData) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        
        img.src = signatureData;
    }

    // Fonction pour exporter toutes les données en CSV
    exportToCSV() {
        const savedForms = this.loadSavedForms();
        
        if (savedForms.length === 0) {
            this.showNotification('⚠️ Aucune donnée à exporter', 'warning');
            return;
        }
        
        const headers = ['Date', 'Dépôt', 'Chantier', 'Stock Début', 'Stock Fin', 'Total Livré', 'Nombre Véhicules'];
        const csvContent = [
            headers.join(','),
            ...savedForms.map(form => [
                form.date || '',
                form.depot || '',
                form.chantier || '',
                form.stockDebut || '',
                form.stockFin || '',
                form.total || '',
                form.vehicules ? form.vehicules.length : 0
            ].map(field => `"${field}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ETER_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('📊 Export CSV téléchargé', 'success');
    }
}

// Fonctions globales pour les événements onclick
function addVehicleRow() {
    eterApp.addVehicleRow();
}

function removeRow(button) {
    eterApp.removeRow(button);
}

function openSignatureModal(canvas) {
    eterApp.openSignatureModal(canvas);
}

function closeSignatureModal() {
    eterApp.closeSignatureModal();
}

function clearModalSignature() {
    eterApp.clearModalSignature();
}

function saveModalSignature() {
    eterApp.saveModalSignature();
}

function clearSignature(canvasId) {
    eterApp.clearSignature(canvasId);
}

function saveForm() {
    eterApp.saveForm();
}

function resetForm() {
    eterApp.resetForm();
}

// Initialisation
let eterApp;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚛 Initialisation ETER App...');
    eterApp = new ETERApp();
    
    // Fermer la modal en cliquant à l'extérieur
    document.getElementById('signatureModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeSignatureModal();
        }
    });
});

// Export global pour accès console
window.eterApp = eterApp;

console.log('✅ ETER App JavaScript chargé');

// Fonction pour afficher les détails d'un rapport
async function viewReportDetails(formId) {
    try {
        const response = await fetch(`/api/forms/${formId}`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des détails');
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const form = data.form;
        const modal = document.getElementById('detailModal');
        const detailsContainer = document.getElementById('reportDetails');
        
        // Formater la date
        const date = new Date(form.date).toLocaleDateString('fr-FR');
        
        // Construire le HTML des détails
        let detailsHTML = `
            <div class="report-details">
                <div class="detail-section">
                    <h3>Informations Générales</h3>
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Entrée:</strong> ${form.entree}</p>
                    <p><strong>Origine:</strong> ${form.origine}</p>
                    <p><strong>Dépôt:</strong> ${form.depot}</p>
                    <p><strong>Chantier:</strong> ${form.chantier}</p>
                </div>
                
                <div class="detail-section">
                    <h3>Stocks et Indices</h3>
                    <p><strong>Stock Début:</strong> ${form.stockDebut}</p>
                    <p><strong>Stock Fin:</strong> ${form.stockFin}</p>
                    <p><strong>Sortie Gasoil:</strong> ${form.sortieGasoil}</p>
                    <p><strong>Début Index:</strong> ${form.debutIndex || 'Non renseigné'}</p>
                    <p><strong>Fin Index:</strong> ${form.finIndex || 'Non renseigné'}</p>
                </div>
                
                <div class="detail-section">
                    <h3>Véhicules</h3>
                    <table class="vehicle-details-table">
                        <thead>
                            <tr>
                                <th>Matricule</th>
                                <th>Chauffeur</th>
                                <th>Heure Revif</th>
                                <th>Quantité Livrée</th>
                                <th>Lieu Comptage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${form.vehicles.map(vehicle => `
                                <tr>
                                    <td>${vehicle.matricule}</td>
                                    <td>${vehicle.chauffeur}</td>
                                    <td>${vehicle.heureRevif || 'Non renseigné'}</td>
                                    <td>${vehicle.quantiteLivree || 'Non renseigné'}</td>
                                    <td>${vehicle.lieuComptage || 'Non renseigné'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="detail-section">
                    <h3>Signatures</h3>
                    <div class="signatures-container">
                        <div class="signature-box">
                            <h4>Signature Responsable</h4>
                            <img src="${form.signatureUrlResponsable}" alt="Signature Responsable" style="max-width: 200px;">
                        </div>
                        <div class="signature-box">
                            <h4>Signature Chef</h4>
                            <img src="${form.signatureUrlChef}" alt="Signature Chef" style="max-width: 200px;">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        detailsContainer.innerHTML = detailsHTML;
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'affichage des détails', 'error');
    }
}

// Fonction pour fermer le modal
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.style.display = 'none';
}

// Fonction pour charger les rapports
async function loadReports() {
    try {
        const response = await fetch('/api/forms');
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des rapports');
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }
        
        const tbody = document.getElementById('reportsTableBody');
        tbody.innerHTML = '';
        
        data.forms.forEach(form => {
            const date = new Date(form.date).toLocaleDateString('fr-FR');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${date}</td>
                <td>${form.depot}</td>
                <td>${form.chantier}</td>
                <td>${form.stockDebut}</td>
                <td>${form.stockFin}</td>
                <td>${form.sortieGasoil}</td>
                <td>${form.vehicles.length}</td>
                <td>
                    <button class="action-btn view-btn" onclick="viewReportDetails('${form.id}')">
                        👁️ Voir
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Mettre à jour les statistiques
        document.getElementById('totalReports').textContent = data.pagination.total;
        document.getElementById('todayReports').textContent = data.forms.filter(f => 
            new Date(f.date).toDateString() === new Date().toDateString()
        ).length;
        
        const totalVehicles = data.forms.reduce((sum, form) => sum + form.vehicles.length, 0);
        document.getElementById('totalVehicles').textContent = totalVehicles;
        
        const totalGasoil = data.forms.reduce((sum, form) => sum + (form.sortieGasoil || 0), 0);
        document.getElementById('totalGasoil').textContent = totalGasoil.toFixed(2);
        
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement des rapports', 'error');
    }
}

// Charger les rapports au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    loadReports();
});