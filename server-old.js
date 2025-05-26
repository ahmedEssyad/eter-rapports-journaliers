// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Pour supporter les signatures base64
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Configuration des variables d'environnement
require('dotenv').config();

// Stockage temporaire en mémoire si MongoDB n'est pas disponible
let tempStorage = [];
let isMongoConnected = false;

// Fonction pour essayer de se connecter à MongoDB
async function connectToMongoDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_forms', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout plus court
            connectTimeoutMS: 5000,
        });
        console.log('✅ Connecté à MongoDB avec succès');
        isMongoConnected = true;
    } catch (error) {
        console.error('❌ Erreur de connexion MongoDB:', error.message);
        console.log('\n🔧 MODE DÉVELOPPEMENT ACTIVÉ:');
        console.log('📦 Stockage temporaire en mémoire utilisé');
        console.log('💡 Les données seront perdues au redémarrage du serveur');
        console.log('💡 Pour MongoDB Atlas, vérifiez vos identifiants dans .env\n');
        isMongoConnected = false;
    }
}

// Gérer les événements de connexion MongoDB
mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connecté');
    isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Erreur MongoDB:', err.message);
    isMongoConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('❌ MongoDB déconnecté');
    isMongoConnected = false;
});

// Appel de la fonction de connexion
connectToMongoDB();

// Schéma MongoDB pour les formulaires ETER
const FormSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    // Informations générales
    entree: { type: String, required: true },
    origine: { type: String, required: true },
    depot: { type: String, required: true },
    chantier: { type: String, required: true },
    date: { type: Date, required: true },
    stockDebut: { type: Number },
    stockFin: { type: Number },
    sortieGasoil: { type: Number },
    debutIndex: { type: Number },
    finIndex: { type: Number },
    // Véhicules
    vehicles: [{
        matricule: { type: String, required: true },
        chauffeur: { type: String, required: true },
        heureRevif: { type: String },
        quantiteLivree: { type: Number },
        lieuComptage: { type: String }
    }],
    // Signatures
    signatureResponsable: { type: String, required: true },
    signatureUrlResponsable: { type: String },
    signatureChef: { type: String, required: true },
    signatureUrlChef: { type: String },
    // Métadonnées
    timestamp: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String }
});

const Form = mongoose.model('Form', FormSchema);

// Créer le dossier pour les signatures si il n'existe pas
const signaturesDir = path.join(__dirname, 'public', 'signatures');
if (!fs.existsSync(signaturesDir)) {
    fs.mkdirSync(signaturesDir, { recursive: true });
}

// Fonction pour sauvegarder la signature comme fichier image
function saveSignatureFile(signatureBase64, formId) {
    try {
        // Extraire les données base64
        const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
        const filename = `signature_${formId}_${Date.now()}.png`;
        const filepath = path.join(signaturesDir, filename);
        
        // Sauvegarder le fichier
        fs.writeFileSync(filepath, base64Data, 'base64');
        
        return `/signatures/${filename}`;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la signature:', error);
        return null;
    }
}

// Routes API

// Route pour soumettre un formulaire ETER
app.post('/api/forms', async (req, res) => {
    try {
        console.log('Nouvelle soumission de formulaire ETER reçue');
        
        const {
            id,
            entree,
            origine,
            depot,
            chantier,
            date,
            stockDebut,
            stockFin,
            sortieGasoil,
            debutIndex,
            finIndex,
            vehicles,
            signatureResponsable,
            signatureChef
        } = req.body;

        // Validation des champs requis
        if (!entree || !origine || !depot || !chantier || !date || !vehicles || !signatureResponsable || !signatureChef) {
            console.error('Champs manquants:', {
                entree: !entree,
                origine: !origine,
                depot: !depot,
                chantier: !chantier,
                date: !date,
                vehicles: !vehicles,
                signatureResponsable: !signatureResponsable,
                signatureChef: !signatureChef
            });
            return res.status(400).json({
                success: false,
                message: 'Champs requis manquants'
            });
        }

        // Vérifier que le dossier signatures existe
        if (!fs.existsSync(signaturesDir)) {
            fs.mkdirSync(signaturesDir, { recursive: true });
        }

        // Sauvegarder les signatures comme fichiers
        const signatureUrlResponsable = saveSignatureFile(signatureResponsable, `${id}_responsable`);
        const signatureUrlChef = saveSignatureFile(signatureChef, `${id}_chef`);

        if (!signatureUrlResponsable || !signatureUrlChef) {
            console.error('Erreur lors de la sauvegarde des signatures');
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde des signatures'
            });
        }

        const formData = {
            id: id || generateUniqueId(),
            entree,
            origine,
            depot,
            chantier,
            date: new Date(date),
            stockDebut: Number(stockDebut),
            stockFin: Number(stockFin),
            sortieGasoil: Number(sortieGasoil),
            debutIndex: Number(debutIndex),
            finIndex: Number(finIndex),
            vehicles: vehicles.map(v => ({
                ...v,
                quantiteLivree: Number(v.quantiteLivree)
            })),
            signatureResponsable,
            signatureUrlResponsable,
            signatureChef,
            signatureUrlChef,
            timestamp: new Date(),
            submittedAt: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        };

        let savedForm;

        if (isMongoConnected) {
            try {
                const mongoForm = new Form(formData);
                savedForm = await mongoForm.save();
                console.log(`Formulaire ETER sauvegardé en MongoDB: ${savedForm.id}`);
            } catch (error) {
                console.error('Erreur MongoDB:', error);
                // Fallback au stockage temporaire
                tempStorage.push(formData);
                savedForm = formData;
                console.log(`Formulaire ETER sauvegardé en mémoire temporaire: ${savedForm.id}`);
            }
        } else {
            tempStorage.push(formData);
            savedForm = formData;
            console.log(`Formulaire ETER sauvegardé en mémoire temporaire: ${savedForm.id}`);
        }
        
        res.status(201).json({
            success: true,
            message: 'Formulaire ETER soumis avec succès',
            formId: savedForm.id,
            signatureUrls: {
                responsable: signatureUrlResponsable,
                chef: signatureUrlChef
            },
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur lors de la soumission:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la soumission',
            error: error.message
        });
    }
});

// Route pour récupérer tous les formulaires
app.get('/api/forms', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        let forms, total;

        if (isMongoConnected) {
            // Récupérer depuis MongoDB
            forms = await Form.find()
                .select('-signature')
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(limit);
            total = await Form.countDocuments();
        } else {
            // Récupérer depuis le stockage temporaire
            const sortedForms = tempStorage
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .map(form => {
                    const { signature, ...formWithoutSignature } = form;
                    return formWithoutSignature;
                });
            
            forms = sortedForms.slice(skip, skip + limit);
            total = tempStorage.length;
        }

        res.json({
            success: true,
            forms,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des formulaires:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des formulaires'
        });
    }
});

// Route pour récupérer un formulaire spécifique
app.get('/api/forms/:id', async (req, res) => {
    try {
        let form;

        if (isMongoConnected) {
            form = await Form.findOne({ id: req.params.id });
        } else {
            form = tempStorage.find(f => f.id === req.params.id);
        }
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Formulaire non trouvé'
            });
        }

        res.json({
            success: true,
            form,
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur lors de la récupération du formulaire:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du formulaire'
        });
    }
});

// Route pour les statistiques
app.get('/api/stats', async (req, res) => {
    try {
        let totalForms, formsToday, totalVehicles, totalGasoil;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isMongoConnected) {
            // Statistiques depuis MongoDB
            totalForms = await Form.countDocuments();
            formsToday = await Form.countDocuments({
                submittedAt: { $gte: today }
            });

            // Calculer le total des véhicules
            const forms = await Form.find();
            totalVehicles = forms.reduce((sum, form) => sum + (form.vehicles ? form.vehicles.length : 0), 0);
            
            // Calculer le total de gasoil livré
            totalGasoil = forms.reduce((sum, form) => {
                const vehicleTotal = form.vehicles ? form.vehicles.reduce((vSum, vehicle) => 
                    vSum + (vehicle.quantiteLivree || 0), 0) : 0;
                return sum + vehicleTotal;
            }, 0);
        } else {
            // Statistiques depuis le stockage temporaire
            totalForms = tempStorage.length;
            formsToday = tempStorage.filter(form => 
                new Date(form.submittedAt) >= today
            ).length;

            // Calculer le total des véhicules
            totalVehicles = tempStorage.reduce((sum, form) => 
                sum + (form.vehicles ? form.vehicles.length : 0), 0);

            // Calculer le total de gasoil livré
            totalGasoil = tempStorage.reduce((sum, form) => {
                const vehicleTotal = form.vehicles ? form.vehicles.reduce((vSum, vehicle) => 
                    vSum + (vehicle.quantiteLivree || 0), 0) : 0;
                return sum + vehicleTotal;
            }, 0);
        }

        res.json({
            success: true,
            stats: {
                totalForms,
                formsToday,
                totalVehicles,
                totalGasoil
            },
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

// Route pour servir le formulaire ETER principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'eter-form.html'));
});

// Route pour l'interface d'administration ETER
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'eter-admin.html'));
});

// Route pour télécharger une facture PDF
app.get('/api/forms/:id/pdf', async (req, res) => {
    try {
        let form;

        if (isMongoConnected) {
            form = await Form.findOne({ id: req.params.id });
        } else {
            form = tempStorage.find(f => f.id === req.params.id);
        }
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Formulaire non trouvé'
            });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 30 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Rapport_Journalier_${form.id}.pdf"`);
        doc.pipe(res);

        // --- HEADER ---
        doc.fontSize(14).font('Helvetica-Bold').text("Etablissement des Travaux d'Entretien Routier -ETER-", { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(11).font('Helvetica-Oblique').fillColor('#333').text("Direction des Approvisionnements et Logistique -DAL-", { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Rapport Journalier', { align: 'center', underline: true });
        doc.moveDown(1);

        // --- INFOS ---
        const startY = doc.y;
        doc.fontSize(10).font('Helvetica').fillColor('#000');
        doc.text('Entrée:', 40, startY, { continued: true }).text(form.entree || '', { width: 100 });
        doc.text('Origine:', 200, startY, { continued: true }).text(form.origine || '', { width: 100 });
        doc.text('Matricule CCG:', 370, startY, { continued: true }).text(form.vehicles && form.vehicles[0] ? form.vehicles[0].matricule : '', { width: 100 });
        doc.text('Date:', 40, startY + 15, { continued: true }).text(form.date ? new Date(form.date).toLocaleDateString('fr-FR') : '', { width: 100 });
        doc.text('Dépôt:', 200, startY + 15, { continued: true }).text(form.depot || '', { width: 100 });
        doc.text('Chantier:', 370, startY + 15, { continued: true }).text(form.chantier || '', { width: 100 });
        doc.text('Stock Début:', 40, startY + 30, { continued: true }).text(form.stockDebut || '', { width: 100 });
        doc.text('Stock Fin:', 200, startY + 30, { continued: true }).text(form.stockFin || '', { width: 100 });
        doc.text('Sortie Gasoil:', 370, startY + 30, { continued: true }).text(form.sortieGasoil || '', { width: 100 });
        doc.text('Début Index:', 40, startY + 45, { continued: true }).text(form.debutIndex || '', { width: 100 });
        doc.text('Fin Index:', 200, startY + 45, { continued: true }).text(form.finIndex || '', { width: 100 });

        // --- TABLE HEADER ---
        doc.moveDown(2);
        const tableTop = doc.y;
        const colWidths = [60, 90, 90, 60, 60, 80];
        const headers = ['Matricule', 'Nom Chauffeur', 'Heure de Revi', 'Qté Livrée', 'Lieu de Ravi', 'Compteur'];
        let x = 40;
        headers.forEach((header, i) => {
            doc.rect(x, tableTop, colWidths[i], 20).stroke();
            doc.font('Helvetica-Bold').fontSize(10).text(header, x + 2, tableTop + 5, { width: colWidths[i] - 4, align: 'center' });
            x += colWidths[i];
        });

        // --- TABLE ROWS ---
        let y = tableTop + 20;
        (form.vehicles || []).forEach(vehicle => {
            x = 40;
            const row = [
                vehicle.matricule || '',
                vehicle.chauffeur || '',
                vehicle.heureRevif || '',
                vehicle.quantiteLivree || '',
                vehicle.lieuComptage || '',
                '' // Compteur vide
            ];
            row.forEach((cell, i) => {
                doc.rect(x, y, colWidths[i], 20).stroke();
                doc.font('Helvetica').fontSize(10).text(cell, x + 2, y + 5, { width: colWidths[i] - 4, align: 'center' });
                x += colWidths[i];
            });
            y += 20;
        });

        // --- SIGNATURES ---
        doc.moveTo(40, y + 30).lineTo(540, y + 30).stroke();
        doc.fontSize(10).font('Helvetica-Oblique').text('Signature Pompiste', 40, y + 35);
        doc.text('Total', 270, y + 35);
        doc.text('Signature Responsable', 440, y + 35);

        // --- SIGNATURE IMAGES ---
        // Signature Responsable
        if (form.signatureUrlResponsable) {
            try {
                const sigPath = path.join(__dirname, 'public', form.signatureUrlResponsable.replace(/^\//, ''));
                if (fs.existsSync(sigPath)) {
                    doc.image(sigPath, 420, y + 55, { width: 100, height: 50 });
                }
            } catch (e) {
                console.error('Erreur chargement signature responsable:', e);
            }
        }
        // Signature Chef
        if (form.signatureUrlChef) {
            try {
                const sigPath = path.join(__dirname, 'public', form.signatureUrlChef.replace(/^\//, ''));
                if (fs.existsSync(sigPath)) {
                    doc.image(sigPath, 420, y + 110, { width: 100, height: 50 });
                }
            } catch (e) {
                console.error('Erreur chargement signature chef:', e);
            }
        }

        doc.end();
    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du PDF'
        });
    }
});

// Gestion des erreurs
app.use((error, req, res, next) => {
    console.error('Erreur non gérée:', error);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur interne'
    });
});

// Route 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

// Fonction utilitaire
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Gestion de la fermeture propre
process.on('SIGINT', async () => {
    console.log('Fermeture du serveur...');
    await mongoose.connection.close();
    process.exit(0);
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Application disponible sur: http://localhost:${PORT}`);
    console.log(`⚙️  Interface admin sur: http://localhost:${PORT}/admin`);
});

module.exports = app;