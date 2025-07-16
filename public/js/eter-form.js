console.log('📁 Chargement ETERForm...');

// Éviter les redéclarations
if (typeof window.ETERForm === 'undefined') {

class ETERForm {
    constructor() {
        console.log('🔧 ETERForm constructor called');
        this.form = document.getElementById('eterForm');
        console.log('📋 Formulaire trouvé:', !!this.form);
        
        this.signatureResponsable = null;
        this.signatureChef = null;
        this.vehicles = [];
        this.currentSignatureType = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.canvas = null;
        this.ctx = null;
        
        if (!this.form) {
            console.error('❌ Erreur: Formulaire #eterForm non trouvé');
            return;
        }
        
        this.initializeEventListeners();
        console.log('✅ ETERForm initialisé avec succès');
    }

    initializeEventListeners() {
        console.log('Initializing event listeners');
        
        // Signature boxes
        const signatureResponsable = document.getElementById('signatureResponsable');
        const signatureChef = document.getElementById('signatureChef');
        
        console.log('Signature boxes:', {
            responsable: signatureResponsable,
            chef: signatureChef
        });
        
        if (signatureResponsable && signatureChef) {
            signatureResponsable.onclick = () => {
                console.log('Clicked signatureResponsable');
                this.openSignatureModal('responsable');
            };
            
            signatureChef.onclick = () => {
                console.log('Clicked signatureChef');
                this.openSignatureModal('chef');
            };
        } else {
            console.error('Error: Signature boxes not found');
        }
        
        // Form buttons
        const saveButton = document.getElementById('saveForm');
        const resetButton = document.getElementById('resetForm');
        const addVehicleButton = document.getElementById('addVehicleRow');
        
        if (saveButton) saveButton.onclick = () => this.saveForm();
        if (resetButton) resetButton.onclick = () => this.resetForm();
        if (addVehicleButton) addVehicleButton.onclick = () => this.addVehicleRow();
        
        // Modal close button
        const closeModal = document.getElementById('closeSignatureModal');
        if (closeModal) {
            closeModal.onclick = () => {
                const modal = document.getElementById('signatureModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            };
        }
        
        // Clear signature button
        const clearSignature = document.getElementById('clearSignature');
        if (clearSignature) {
            clearSignature.onclick = () => this.clearSignature();
        }
        
        // Save signature button
        const saveSignature = document.getElementById('saveSignature');
        if (saveSignature) {
            saveSignature.onclick = () => this.saveSignature();
        }
        
        // Close modal when clicking outside
        window.onclick = (e) => {
            const modal = document.getElementById('signatureModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    openSignatureModal(type) {
        console.log(`Opening signature modal for ${type}`);
        this.currentSignatureType = type;
        const modal = document.getElementById('signatureModal');
        
        if (!modal) {
            console.error('Error: Modal not found');
            return;
        }
        
        this.canvas = document.getElementById('signatureCanvas');
        if (!this.canvas) {
            console.error('Error: Canvas not found');
            return;
        }

        console.log('Canvas found:', this.canvas);
        
        // Set canvas size
        this.canvas.width = 500;
        this.canvas.height = 300;
        
        this.ctx = this.canvas.getContext('2d');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Mouse events
        this.canvas.onmousedown = this.startDrawing.bind(this);
        this.canvas.onmousemove = this.draw.bind(this);
        this.canvas.onmouseup = this.stopDrawing.bind(this);
        this.canvas.onmouseout = this.stopDrawing.bind(this);
        
        // Touch events
        this.canvas.ontouchstart = this.handleTouch.bind(this);
        this.canvas.ontouchmove = this.handleTouch.bind(this);
        this.canvas.ontouchend = this.stopDrawing.bind(this);
        
        // Show modal
        modal.style.display = 'block';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        
        // Fix aria-hidden accessibility issue
        modal.removeAttribute('aria-hidden');
        
        console.log('Modal displayed');
    }

    startDrawing(e) {
        e.preventDefault();
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        e.preventDefault();
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        if (e.type === 'touchstart') {
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;
        } else if (e.type === 'touchmove' && this.isDrawing) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            this.lastX = x;
            this.lastY = y;
        }
    }

    clearSignature() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    saveSignature() {
        if (!this.canvas) {
            console.error('Error: Canvas not found when saving');
            return;
        }

        const signatureData = this.canvas.toDataURL('image/png');
        
        if (this.currentSignatureType === 'driver') {
            // Save driver signature
            if (!this.driverSignatures) {
                this.driverSignatures = {};
            }
            this.driverSignatures[this.currentDriverSignatureIndex] = signatureData;
            
            // Update UI
            const signatureBtn = document.querySelector(`#vehicleTableBody tr:nth-child(${this.currentDriverSignatureIndex + 1}) .signature-btn`);
            const signaturePreview = document.getElementById(`driverSignature_${this.currentDriverSignatureIndex}`);
            
            if (signatureBtn && signaturePreview) {
                signatureBtn.style.display = 'none';
                signaturePreview.style.display = 'block';
            }
            
            document.getElementById('signatureModal').style.display = 'none';
        } else {
            // Save responsable or chef signature
            const signatureBox = document.getElementById(`signature${this.currentSignatureType.charAt(0).toUpperCase() + this.currentSignatureType.slice(1)}`);
            const img = signatureBox.querySelector('img');
            
            if (this.currentSignatureType === 'responsable') {
                this.signatureResponsable = signatureData;
            } else {
                this.signatureChef = signatureData;
            }
            
            img.src = signatureData;
            img.style.display = 'block';
            signatureBox.classList.add('has-signature');
            
            document.getElementById('signatureModal').style.display = 'none';
        }
    }

    addVehicleRow() {
        const tbody = document.getElementById('vehicleTableBody');
        const row = document.createElement('tr');
        const rowIndex = tbody.children.length;
        row.innerHTML = `
            <td><input type="text" name="matricule[]" class="form-control" required></td>
            <td><input type="text" name="chauffeur[]" class="form-control" required></td>
            <td>
                <button type="button" class="btn btn-info btn-sm signature-btn" onclick="eterForm.openDriverSignatureModal(${rowIndex})">
                    <i class="fas fa-signature"></i> Signer
                </button>
                <div class="driver-signature-preview" id="driverSignature_${rowIndex}" style="display: none;">
                    <small class="text-success">✓ Signé</small>
                </div>
            </td>
            <td><input type="time" name="heureRevif[]" class="form-control"></td>
            <td><input type="number" name="quantiteLivree[]" class="form-control" step="0.01"></td>
            <td><input type="text" name="lieuComptage[]" class="form-control"></td>
            <td>
                <button type="button" class="btn btn-danger btn-sm" onclick="eterForm.removeVehicleRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    }

    removeVehicleRow(button) {
        const row = button.closest('tr');
        row.remove();
    }

    openDriverSignatureModal(rowIndex) {
        this.currentDriverSignatureIndex = rowIndex;
        this.currentSignatureType = 'driver';
        
        const modal = document.getElementById('signatureModal');
        const modalTitle = document.getElementById('signatureModalLabel');
        modalTitle.textContent = 'Signature du Chauffeur';
        
        if (!modal) {
            console.error('Error: Modal not found');
            return;
        }
        
        this.canvas = document.getElementById('signatureCanvas');
        if (!this.canvas) {
            console.error('Error: Canvas not found');
            return;
        }

        // Set canvas size
        this.canvas.width = 500;
        this.canvas.height = 300;
        
        this.ctx = this.canvas.getContext('2d');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Mouse events
        this.canvas.onmousedown = this.startDrawing.bind(this);
        this.canvas.onmousemove = this.draw.bind(this);
        this.canvas.onmouseup = this.stopDrawing.bind(this);
        this.canvas.onmouseout = this.stopDrawing.bind(this);
        
        // Touch events
        this.canvas.ontouchstart = this.handleTouch.bind(this);
        this.canvas.ontouchmove = this.handleTouch.bind(this);
        this.canvas.ontouchend = this.stopDrawing.bind(this);
        
        // Show modal
        modal.style.display = 'block';
        
        // Fix aria-hidden accessibility issue
        modal.removeAttribute('aria-hidden');
    }


    async saveForm() {
        try {
            // Validate required fields
            if (!this.validateForm()) {
                this.showNotification('Veuillez remplir tous les champs obligatoires', 'error');
                return;
            }

            // Collect form data
            const formData = {
                id: this.generateUniqueId(),
                entree: document.getElementById('entree').value,
                origine: document.getElementById('origine').value,
                depot: document.getElementById('depot').value,
                chantier: document.getElementById('chantier').value,
                date: document.getElementById('date').value,
                stockDebut: parseFloat(document.getElementById('stockDebut').value) || 0,
                stockFin: parseFloat(document.getElementById('stockFin').value) || 0,
                sortieGasoil: parseFloat(document.getElementById('sortieGasoil').value) || 0,
                debutIndex: parseFloat(document.getElementById('debutIndex').value) || 0,
                finIndex: parseFloat(document.getElementById('finIndex').value) || 0,
                vehicles: this.collectVehicleData(),
                signatureResponsable: this.signatureResponsable,
                signatureChef: this.signatureChef,
                timestamp: new Date().toISOString(),
                submittedOffline: !navigator.onLine
            };

            console.log('📋 Données collectées:', formData);

            // 📱 Priorité au système offline-first
            if (typeof offlineManager !== 'undefined' && offlineManager) {
                const formId = await offlineManager.saveFormOffline(formData);
                console.log('✅ Formulaire sauvé avec ID:', formId);
                
                this.showSaveProgress(false);
                this.showNotification('Formulaire sauvé avec succès!', 'success');
                
                // 🧹 Réinitialiser après délai
                setTimeout(() => {
                    this.resetForm();
                }, 1500);
                
                return formId;
                
            } else {
                // 🌐 Fallback: envoi direct
                console.warn('⚠️ OfflineManager non disponible - Envoi direct');
                return await this.saveFormDirect(formData);
            }
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);
            this.showSaveProgress(false);
            this.showNotification('Erreur lors de la sauvegarde: ' + error.message, 'error');
        }
    }

    // 🌐 Sauvegarde directe (fallback)
    async saveFormDirect(formData) {
        const response = await fetch('/api/forms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            this.showSaveProgress(false);
            this.showNotification('Formulaire envoyé avec succès!', 'success');
            
            setTimeout(() => {
                this.resetForm();
            }, 1500);
            
            return result.id;
        } else {
            throw new Error(result.message || 'Erreur serveur');
        }
    }

    // 🔄 Indicateur de progression
    showSaveProgress(show) {
        const saveButton = document.getElementById('saveForm');
        const syncProgress = document.getElementById('syncProgress');
        
        if (saveButton) {
            if (show) {
                saveButton.disabled = true;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
                saveButton.classList.add('syncing');
            } else {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> Enregistrer';
                saveButton.classList.remove('syncing');
            }
        }
        
        if (syncProgress) {
            if (show) {
                syncProgress.classList.add('active');
            } else {
                syncProgress.classList.remove('active');
            }
        }
    }

    validateForm() {
        const requiredFields = [
            'entree', 'origine', 'depot', 'chantier', 'date',
            'stockDebut', 'stockFin', 'sortieGasoil'
        ];

        for (const field of requiredFields) {
            if (!document.getElementById(field).value) {
                return false;
            }
        }

        if (!this.signatureResponsable || !this.signatureChef) {
            return false;
        }

        const vehicles = this.collectVehicleData();
        if (vehicles.length === 0) {
            return false;
        }

        return true;
    }

    collectVehicleData() {
        const vehicles = [];
        const rows = document.querySelectorAll('#vehicleTableBody tr');
        
        rows.forEach((row, index) => {
            const inputs = row.querySelectorAll('input');
            vehicles.push({
                matricule: inputs[0].value,
                chauffeur: inputs[1].value,
                signatureDriver: this.driverSignatures && this.driverSignatures[index] ? this.driverSignatures[index] : null,
                heureRevif: inputs[2].value,
                quantiteLivree: inputs[3].value,
                lieuComptage: inputs[4].value
            });
        });

        return vehicles;
    }

    resetForm() {
        this.form.reset();
        this.signatureResponsable = null;
        this.signatureChef = null;
        this.driverSignatures = {};
        
        const responsableImg = document.querySelector('#signatureResponsable img');
        const chefImg = document.querySelector('#signatureChef img');
        
        if (responsableImg) {
            responsableImg.src = '';
            responsableImg.style.display = 'none';
        }
        if (chefImg) {
            chefImg.src = '';
            chefImg.style.display = 'none';
        }
        
        // Remove has-signature class
        document.getElementById('signatureResponsable').classList.remove('has-signature');
        document.getElementById('signatureChef').classList.remove('has-signature');
        
        document.getElementById('vehicleTableBody').innerHTML = '';
        this.showNotification('Formulaire réinitialisé', 'success');
    }

    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }
}

window.ETERForm = ETERForm;

} // Fin du if typeof window.ETERForm === 'undefined'

// 📁 ETERForm class définie et prête
console.log('✅ Script eter-form.js chargé - ETERForm disponible');