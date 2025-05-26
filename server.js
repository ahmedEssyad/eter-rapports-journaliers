// server.js - Version améliorée avec authentification
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration des variables d'environnement
require('dotenv').config();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'eter-secret-key-2025';

// Stockage temporaire
let tempStorage = [];
let isMongoConnected = false;
let tempUsers = [
    {
        id: 'admin',
        username: 'admin',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
        name: 'Administrateur',
        role: 'admin',
        createdAt: new Date()
    }
];

// Connexion MongoDB
async function connectToMongoDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/employee_forms', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        console.log('✅ Connecté à MongoDB avec succès');
        isMongoConnected = true;
        
        // Créer un utilisateur admin par défaut
        await createDefaultAdmin();
    } catch (error) {
        console.error('❌ Erreur de connexion MongoDB:', error.message);
        console.log('\n🔧 MODE DÉVELOPPEMENT ACTIVÉ:');
        console.log('📦 Stockage temporaire en mémoire utilisé');
        console.log('💡 Utilisateur par défaut: admin / admin123');
        isMongoConnected = false;
    }
}

// Schémas MongoDB
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
});

const FormSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
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
    vehicles: [{
        matricule: { type: String, required: true },
        chauffeur: { type: String, required: true },
        heureRevif: { type: String },
        quantiteLivree: { type: Number },
        lieuComptage: { type: String }
    }],
    signatureResponsable: { type: String, required: true },
    signatureUrlResponsable: { type: String },
    signatureChef: { type: String, required: true },
    signatureUrlChef: { type: String },
    timestamp: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    ipAddress: { type: String },
    userAgent: { type: String }
});

const User = mongoose.model('User', UserSchema);
const Form = mongoose.model('Form', FormSchema);

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token d\'accès requis' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Token invalide' });
    }
};

// Créer utilisateur admin par défaut
async function createDefaultAdmin() {
    try {
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                name: 'Administrateur',
                role: 'admin'
            });
            await admin.save();
            console.log('👤 Utilisateur admin créé: admin / admin123');
        }
    } catch (error) {
        console.error('Erreur création admin:', error);
    }
}

// Créer dossiers nécessaires
const signaturesDir = path.join(__dirname, 'public', 'signatures');
if (!fs.existsSync(signaturesDir)) {
    fs.mkdirSync(signaturesDir, { recursive: true });
}

// Fonction utilitaires
function saveSignatureFile(signatureBase64, formId) {
    try {
        const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
        const filename = `signature_${formId}_${Date.now()}.png`;
        const filepath = path.join(signaturesDir, filename);
        
        fs.writeFileSync(filepath, base64Data, 'base64');
        return `/signatures/${filename}`;
    } catch (error) {
        console.error('Erreur sauvegarde signature:', error);
        return null;
    }
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Routes de debug et monitoring
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: isMongoConnected ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        env_vars: {
            mongodb_uri: !!process.env.MONGODB_URI,
            jwt_secret: !!process.env.JWT_SECRET
        }
    });
});

app.get('/debug', (req, res) => {
    res.json({
        message: 'Debug endpoint actif',
        mongodb_connected: isMongoConnected,
        temp_users: tempUsers.length,
        temp_storage: tempStorage.length,
        jwt_secret_defined: !!process.env.JWT_SECRET,
        mongodb_uri_defined: !!process.env.MONGODB_URI
    });
});

// Routes d'authentification
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nom d\'utilisateur et mot de passe requis'
            });
        }

        let user;
        
        if (isMongoConnected) {
            user = await User.findOne({ username });
        } else {
            user = tempUsers.find(u => u.username === username);
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Nom d\'utilisateur ou mot de passe incorrect'
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Nom d\'utilisateur ou mot de passe incorrect'
            });
        }

        const token = jwt.sign(
            { 
                id: user._id || user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 heures

        // Mettre à jour la dernière connexion
        if (isMongoConnected) {
            await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
        } else {
            user.lastLogin = new Date();
        }

        res.json({
            success: true,
            token,
            expiry,
            user: {
                id: user._id || user.id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Routes pour les formulaires (publiques)
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

        if (!entree || !origine || !depot || !chantier || !date || !vehicles || !signatureResponsable || !signatureChef) {
            return res.status(400).json({
                success: false,
                message: 'Champs requis manquants'
            });
        }

        const signatureUrlResponsable = saveSignatureFile(signatureResponsable, `${id || generateUniqueId()}_responsable`);
        const signatureUrlChef = saveSignatureFile(signatureChef, `${id || generateUniqueId()}_chef`);

        if (!signatureUrlResponsable || !signatureUrlChef) {
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

// Routes admin (protégées)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        let totalForms, formsToday, totalVehicles, totalGasoil;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isMongoConnected) {
            totalForms = await Form.countDocuments();
            formsToday = await Form.countDocuments({
                submittedAt: { $gte: today }
            });

            const forms = await Form.find();
            totalVehicles = forms.reduce((sum, form) => sum + (form.vehicles ? form.vehicles.length : 0), 0);
            
            totalGasoil = forms.reduce((sum, form) => {
                const vehicleTotal = form.vehicles ? form.vehicles.reduce((vSum, vehicle) => 
                    vSum + (vehicle.quantiteLivree || 0), 0) : 0;
                return sum + vehicleTotal;
            }, 0);
        } else {
            totalForms = tempStorage.length;
            formsToday = tempStorage.filter(form => 
                new Date(form.submittedAt) >= today
            ).length;

            totalVehicles = tempStorage.reduce((sum, form) => 
                sum + (form.vehicles ? form.vehicles.length : 0), 0);

            totalGasoil = tempStorage.reduce((sum, form) => {
                const vehicleTotal = form.vehicles ? form.vehicles.reduce((vSum, vehicle) => 
                    vSum + (vehicle.quantiteLivree || 0), 0) : 0;
                return sum + vehicleTotal;
            }, 0);
        }

        // Calculer les conducteurs uniques
        const uniqueDrivers = new Set();
        const allForms = isMongoConnected ? await Form.find() : tempStorage;
        
        allForms.forEach(form => {
            if (form.vehicles) {
                form.vehicles.forEach(vehicle => {
                    if (vehicle.chauffeur) {
                        uniqueDrivers.add(vehicle.chauffeur.toLowerCase());
                    }
                });
            }
        });

        res.json({
            success: true,
            stats: {
                totalForms,
                formsToday,
                totalVehicles,
                totalDrivers: uniqueDrivers.size,
                totalGasoil: Math.round(totalGasoil)
            },
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

app.get('/api/admin/reports', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        let forms, total;

        if (isMongoConnected) {
            forms = await Form.find()
                .select('-signatureResponsable -signatureChef')
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(limit);
            total = await Form.countDocuments();
        } else {
            const sortedForms = tempStorage
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .map(form => {
                    const { signatureResponsable, signatureChef, ...formWithoutSignatures } = form;
                    return formWithoutSignatures;
                });
            
            forms = sortedForms.slice(skip, skip + limit);
            total = tempStorage.length;
        }

        res.json({
            success: true,
            reports: forms,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur reports:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des rapports'
        });
    }
});

app.get('/api/admin/reports/:id', authenticateToken, async (req, res) => {
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
                message: 'Rapport non trouvé'
            });
        }

        res.json({
            success: true,
            report: form,
            storage: isMongoConnected ? 'MongoDB' : 'Mémoire temporaire'
        });

    } catch (error) {
        console.error('Erreur rapport:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du rapport'
        });
    }
});

// Route pour télécharger un rapport PDF
app.get('/api/admin/reports/:id/pdf', authenticateToken, async (req, res) => {
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
                message: 'Rapport non trouvé'
            });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Rapport_Journalier_${form.id}.pdf"`);
        doc.pipe(res);

        // === EN-TÊTE EXACT COMME L'ORIGINAL ===
        // Bordure principale
        doc.rect(20, 20, 555, 750).stroke();
        
        // En-tête principal
        doc.rect(20, 20, 555, 60).stroke();
        doc.fontSize(12).font('Helvetica-Bold').text("Etablissement des Travaux d'Entretien Routier -ETER-", 30, 35, { align: 'center', width: 535 });
        doc.fontSize(10).font('Helvetica-Oblique').text("Direction des Approvisionnements et Logistique -DAL-", 30, 50, { align: 'center', width: 535 });
        
        // Titre du rapport avec numéro
        doc.rect(20, 80, 555, 30).stroke();
        doc.fontSize(14).font('Helvetica-Bold').text(`Rapport Journalier`, 30, 90, { width: 400 });
        doc.fontSize(10).text(`N° ${form.id}`, 450, 95);

        // === SECTION INFORMATIONS GÉNÉRALES ===
        let currentY = 120;
        
        // Première ligne
        doc.rect(20, currentY, 170, 25).stroke();
        doc.rect(190, currentY, 170, 25).stroke();
        doc.rect(360, currentY, 95, 25).stroke();
        doc.rect(455, currentY, 120, 25).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Entrée', 25, currentY + 3);
        doc.text('Origine', 195, currentY + 3);
        doc.text('Matricule CCG', 365, currentY + 3);
        doc.text('Date', 460, currentY + 3);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(form.entree || '', 25, currentY + 12);
        doc.text(form.origine || '', 195, currentY + 12);
        doc.text(form.vehicles && form.vehicles[0] ? form.vehicles[0].matricule : '', 365, currentY + 12);
        doc.text(form.date ? new Date(form.date).toLocaleDateString('fr-FR') : '', 460, currentY + 12);
        
        currentY += 25;
        
        // Deuxième ligne
        doc.rect(20, currentY, 170, 25).stroke();
        doc.rect(190, currentY, 170, 25).stroke();
        doc.rect(360, currentY, 95, 25).stroke();
        doc.rect(455, currentY, 60, 25).stroke();
        doc.rect(515, currentY, 60, 25).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Dépôt', 25, currentY + 3);
        doc.text('Chantier', 195, currentY + 3);
        doc.text('Stock Début', 365, currentY + 3);
        doc.text('Stock Fin', 460, currentY + 3);
        doc.text('Sortie Gasoil', 520, currentY + 3);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(form.depot || '', 25, currentY + 12);
        doc.text(form.chantier || '', 195, currentY + 12);
        doc.text((form.stockDebut || 0).toString(), 365, currentY + 12);
        doc.text((form.stockFin || 0).toString(), 460, currentY + 12);
        doc.text((form.sortieGasoil || 0).toString(), 520, currentY + 12);
        
        currentY += 25;
        
        // Troisième ligne
        doc.rect(20, currentY, 170, 25).stroke();
        doc.rect(190, currentY, 170, 25).stroke();
        doc.rect(360, currentY, 95, 25).stroke();
        doc.rect(455, currentY, 60, 25).stroke();
        doc.rect(515, currentY, 60, 25).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Début Index', 365, currentY + 3);
        doc.text('Fin Index', 460, currentY + 3);
        
        doc.fontSize(8).font('Helvetica');
        doc.text((form.debutIndex || '').toString(), 365, currentY + 12);
        doc.text((form.finIndex || '').toString(), 460, currentY + 12);
        
        currentY += 35;

        // === TABLE DES VÉHICULES EXACTE ===
        const tableStartY = currentY;
        const colWidths = [70, 90, 60, 50, 70, 80, 80, 70];
        const headers = ['Matricule', 'Nom Chauffeur', 'Signature', 'Heur de Revi', 'Qté Livrée', 'Lieu de Ravi', 'Compteur'];
        
        // En-têtes du tableau
        let x = 20;
        headers.forEach((header, i) => {
            doc.rect(x, currentY, colWidths[i], 25).stroke();
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text(header, x + 2, currentY + 8, { width: colWidths[i] - 4, align: 'center' });
            x += colWidths[i];
        });
        
        currentY += 25;
        
        // Lignes des véhicules
        let totalQuantite = 0;
        const maxRows = 15; // Nombre de lignes comme dans l'original
        
        for (let i = 0; i < maxRows; i++) {
            x = 20;
            const vehicle = form.vehicles && form.vehicles[i] ? form.vehicles[i] : {};
            
            const rowData = [
                vehicle.matricule || '',
                vehicle.chauffeur || '',
                '', // Signature (espace vide pour l'instant)
                vehicle.heureRevif || '',
                vehicle.quantiteLivree ? vehicle.quantiteLivree.toString() : '',
                vehicle.lieuComptage || '',
                '', // Compteur (vide comme dans l'original)
            ];
            
            if (vehicle.quantiteLivree) {
                totalQuantite += vehicle.quantiteLivree;
            }
            
            rowData.forEach((cell, j) => {
                doc.rect(x, currentY, colWidths[j], 20).stroke();
                doc.fontSize(8).font('Helvetica');
                doc.text(cell, x + 2, currentY + 6, { width: colWidths[j] - 4, align: 'center' });
                x += colWidths[j];
            });
            
            currentY += 20;
        }
        
        // === SECTION SIGNATURES EN BAS ===
        currentY += 20;
        
        // Ligne de séparation
        doc.moveTo(20, currentY).lineTo(575, currentY).stroke();
        currentY += 10;
        
        // Zone signatures
        doc.fontSize(9).font('Helvetica');
        doc.text('Signature Pompiste', 30, currentY);
        doc.text(`Total: ${totalQuantite}L`, 250, currentY);
        doc.text('Signature Responsable', 450, currentY);
        
        currentY += 20;
        
        // Affichage des signatures si disponibles
        if (form.signatureUrlResponsable) {
            try {
                const sigPath = path.join(__dirname, 'public', form.signatureUrlResponsable.replace(/^\//, ''));
                if (fs.existsSync(sigPath)) {
                    doc.image(sigPath, 30, currentY, { width: 120, height: 60 });
                }
            } catch (e) {
                console.error('Erreur signature pompiste:', e);
            }
        }
        
        if (form.signatureUrlChef) {
            try {
                const sigPath = path.join(__dirname, 'public', form.signatureUrlChef.replace(/^\//, ''));
                if (fs.existsSync(sigPath)) {
                    doc.image(sigPath, 420, currentY, { width: 120, height: 60 });
                }
            } catch (e) {
                console.error('Erreur signature responsable:', e);
            }
        }

        doc.end();

    } catch (error) {
        console.error('Erreur PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération du PDF'
        });
    }
});

// Route pour exporter tous les rapports en PDF
app.post('/api/admin/reports/export/all', authenticateToken, async (req, res) => {
    try {
        let forms;

        if (isMongoConnected) {
            forms = await Form.find().sort({ submittedAt: -1 });
        } else {
            forms = tempStorage.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        }
        
        if (forms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun rapport trouvé'
            });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Rapports_Complets_ETER_${new Date().toISOString().split('T')[0]}.pdf"`);
        doc.pipe(res);

        // Page de garde
        doc.fontSize(20).font('Helvetica-Bold').text("ETER - Rapports Journaliers", { align: 'center' });
        doc.fontSize(14).text("Compilation Complète", { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
        doc.text(`Nombre de rapports: ${forms.length}`, { align: 'center' });
        doc.addPage();

        // Générer chaque rapport
        forms.forEach((form, index) => {
            generateSingleReportPDF(doc, form);
            
            // Ajouter une nouvelle page sauf pour le dernier rapport
            if (index < forms.length - 1) {
                doc.addPage();
            }
        });

        doc.end();

    } catch (error) {
        console.error('Erreur export all:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export global'
        });
    }
});

// Route pour exporter les rapports sélectionnés
app.post('/api/admin/reports/export/selected', authenticateToken, async (req, res) => {
    try {
        const { reportIds } = req.body;
        
        if (!reportIds || reportIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun rapport sélectionné'
            });
        }

        let forms;

        if (isMongoConnected) {
            forms = await Form.find({ id: { $in: reportIds } }).sort({ submittedAt: -1 });
        } else {
            forms = tempStorage.filter(f => reportIds.includes(f.id))
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        }
        
        if (forms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun rapport trouvé'
            });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Rapports_Selection_ETER_${new Date().toISOString().split('T')[0]}.pdf"`);
        doc.pipe(res);

        // Page de garde
        doc.fontSize(20).font('Helvetica-Bold').text("ETER - Rapports Sélectionnés", { align: 'center' });
        doc.fontSize(14).text("Compilation Sélective", { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
        doc.text(`Nombre de rapports: ${forms.length}`, { align: 'center' });
        doc.addPage();

        // Générer chaque rapport
        forms.forEach((form, index) => {
            generateSingleReportPDF(doc, form);
            
            // Ajouter une nouvelle page sauf pour le dernier rapport
            if (index < forms.length - 1) {
                doc.addPage();
            }
        });

        doc.end();

    } catch (error) {
        console.error('Erreur export selected:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export de la sélection'
        });
    }
});

// Fonction utilitaire pour générer un rapport PDF
function generateSingleReportPDF(doc, form) {
    // === EN-TÊTE EXACT COMME L'ORIGINAL ===
    // Bordure principale
    doc.rect(20, 20, 555, 750).stroke();
    
    // En-tête principal
    doc.rect(20, 20, 555, 60).stroke();
    doc.fontSize(12).font('Helvetica-Bold').text("Etablissement des Travaux d'Entretien Routier -ETER-", 30, 35, { align: 'center', width: 535 });
    doc.fontSize(10).font('Helvetica-Oblique').text("Direction des Approvisionnements et Logistique -DAL-", 30, 50, { align: 'center', width: 535 });
    
    // Titre du rapport avec numéro
    doc.rect(20, 80, 555, 30).stroke();
    doc.fontSize(14).font('Helvetica-Bold').text(`Rapport Journalier`, 30, 90, { width: 400 });
    doc.fontSize(10).text(`N° ${form.id}`, 450, 95);

    // === SECTION INFORMATIONS GÉNÉRALES ===
    let currentY = 120;
    
    // Première ligne
    doc.rect(20, currentY, 170, 25).stroke();
    doc.rect(190, currentY, 170, 25).stroke();
    doc.rect(360, currentY, 95, 25).stroke();
    doc.rect(455, currentY, 120, 25).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Entrée', 25, currentY + 3);
    doc.text('Origine', 195, currentY + 3);
    doc.text('Matricule CCG', 365, currentY + 3);
    doc.text('Date', 460, currentY + 3);
    
    doc.fontSize(8).font('Helvetica');
    doc.text(form.entree || '', 25, currentY + 12);
    doc.text(form.origine || '', 195, currentY + 12);
    doc.text(form.vehicles && form.vehicles[0] ? form.vehicles[0].matricule : '', 365, currentY + 12);
    doc.text(form.date ? new Date(form.date).toLocaleDateString('fr-FR') : '', 460, currentY + 12);
    
    currentY += 25;
    
    // Deuxième ligne
    doc.rect(20, currentY, 170, 25).stroke();
    doc.rect(190, currentY, 170, 25).stroke();
    doc.rect(360, currentY, 95, 25).stroke();
    doc.rect(455, currentY, 60, 25).stroke();
    doc.rect(515, currentY, 60, 25).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Dépôt', 25, currentY + 3);
    doc.text('Chantier', 195, currentY + 3);
    doc.text('Stock Début', 365, currentY + 3);
    doc.text('Stock Fin', 460, currentY + 3);
    doc.text('Sortie Gasoil', 520, currentY + 3);
    
    doc.fontSize(8).font('Helvetica');
    doc.text(form.depot || '', 25, currentY + 12);
    doc.text(form.chantier || '', 195, currentY + 12);
    doc.text((form.stockDebut || 0).toString(), 365, currentY + 12);
    doc.text((form.stockFin || 0).toString(), 460, currentY + 12);
    doc.text((form.sortieGasoil || 0).toString(), 520, currentY + 12);
    
    currentY += 25;
    
    // Troisième ligne
    doc.rect(20, currentY, 170, 25).stroke();
    doc.rect(190, currentY, 170, 25).stroke();
    doc.rect(360, currentY, 95, 25).stroke();
    doc.rect(455, currentY, 60, 25).stroke();
    doc.rect(515, currentY, 60, 25).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Début Index', 365, currentY + 3);
    doc.text('Fin Index', 460, currentY + 3);
    
    doc.fontSize(8).font('Helvetica');
    doc.text((form.debutIndex || '').toString(), 365, currentY + 12);
    doc.text((form.finIndex || '').toString(), 460, currentY + 12);
    
    currentY += 35;

    // === TABLE DES VÉHICULES EXACTE ===
    const colWidths = [70, 90, 60, 50, 70, 80, 80, 70];
    const headers = ['Matricule', 'Nom Chauffeur', 'Signature', 'Heur de Revi', 'Qté Livrée', 'Lieu de Ravi', 'Compteur'];
    
    // En-têtes du tableau
    let x = 20;
    headers.forEach((header, i) => {
        doc.rect(x, currentY, colWidths[i], 25).stroke();
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text(header, x + 2, currentY + 8, { width: colWidths[i] - 4, align: 'center' });
        x += colWidths[i];
    });
    
    currentY += 25;
    
    // Lignes des véhicules
    let totalQuantite = 0;
    const maxRows = 15; // Nombre de lignes comme dans l'original
    
    for (let i = 0; i < maxRows; i++) {
        x = 20;
        const vehicle = form.vehicles && form.vehicles[i] ? form.vehicles[i] : {};
        
        const rowData = [
            vehicle.matricule || '',
            vehicle.chauffeur || '',
            '', // Signature (espace vide pour l'instant)
            vehicle.heureRevif || '',
            vehicle.quantiteLivree ? vehicle.quantiteLivree.toString() : '',
            vehicle.lieuComptage || '',
            '', // Compteur (vide comme dans l'original)
        ];
        
        if (vehicle.quantiteLivree) {
            totalQuantite += vehicle.quantiteLivree;
        }
        
        rowData.forEach((cell, j) => {
            doc.rect(x, currentY, colWidths[j], 20).stroke();
            doc.fontSize(8).font('Helvetica');
            doc.text(cell, x + 2, currentY + 6, { width: colWidths[j] - 4, align: 'center' });
            x += colWidths[j];
        });
        
        currentY += 20;
    }
    
    // === SECTION SIGNATURES EN BAS ===
    currentY += 20;
    
    // Ligne de séparation
    doc.moveTo(20, currentY).lineTo(575, currentY).stroke();
    currentY += 10;
    
    // Zone signatures
    doc.fontSize(9).font('Helvetica');
    doc.text('Signature Pompiste', 30, currentY);
    doc.text(`Total: ${totalQuantite}L`, 250, currentY);
    doc.text('Signature Responsable', 450, currentY);
    
    currentY += 20;
    
    // Affichage des signatures si disponibles
    if (form.signatureUrlResponsable) {
        try {
            const sigPath = path.join(__dirname, 'public', form.signatureUrlResponsable.replace(/^\//, ''));
            if (fs.existsSync(sigPath)) {
                doc.image(sigPath, 30, currentY, { width: 120, height: 60 });
            }
        } catch (e) {
            console.error('Erreur signature pompiste:', e);
        }
    }
    
    if (form.signatureUrlChef) {
        try {
            const sigPath = path.join(__dirname, 'public', form.signatureUrlChef.replace(/^\//, ''));
            if (fs.existsSync(sigPath)) {
                doc.image(sigPath, 420, currentY, { width: 120, height: 60 });
            }
        } catch (e) {
            console.error('Erreur signature responsable:', e);
        }
    }
}
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'eter-form.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.redirect('/login.html');
});

// Gestion des erreurs
app.use((error, req, res, next) => {
    console.error('Erreur non gérée:', error);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur interne'
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

// Gestion événements MongoDB
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

// Gestion de la fermeture
process.on('SIGINT', async () => {
    console.log('Fermeture du serveur...');
    await mongoose.connection.close();
    process.exit(0);
});

// Démarrage
connectToMongoDB();

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Application disponible sur: http://localhost:${PORT}`);
    console.log(`🔐 Interface admin sur: http://localhost:${PORT}/admin-dashboard`);
    console.log(`👤 Connexion admin: http://localhost:${PORT}/login.html`);
    console.log(`💡 Identifiants par défaut: admin / admin123`);
});

module.exports = app;