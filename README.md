# 🚛 ETER - Système de Rapports Journaliers

Application web complète pour la gestion des rapports journaliers de l'Établissement des Travaux d'Entretien Routier (ETER).

## ✨ Fonctionnalités

### 👥 Interface Employé
- **Formulaire digital** reproduisant fidèlement le format papier
- **Signatures numériques** pour pompiste et responsable
- **Gestion multi-véhicules** avec détails des conducteurs
- **Validation en temps réel** des données saisies
- **Mode hors-ligne** avec synchronisation automatique
- **PWA installable** sur mobile et desktop

### 🎛️ Dashboard Administrateur
- **Interface moderne** avec graphiques interactifs
- **Statistiques en temps réel** (rapports, véhicules, carburant)
- **Filtrage et recherche avancés** par date, véhicule, statut
- **Export multi-formats** : PDF fidèle, CSV, Excel
- **Visualisations** : évolution mensuelle, consommation par véhicule
- **Gestion sécurisée** avec authentification JWT

### 🔒 Sécurité
- **Authentification JWT** avec tokens sécurisés
- **Mots de passe hashés** avec bcryptjs
- **Routes API protégées** pour l'administration
- **Validation des données** côté serveur et client
- **Sessions avec expiration** automatique

## 🚀 Installation et Configuration

### Prérequis
- Node.js >= 16.0.0
- MongoDB Atlas (ou MongoDB local)
- Git

### Installation
```bash
# Cloner le projet
git clone <url-du-repo>
cd offline-form-app

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos paramètres MongoDB et JWT
```

### Configuration MongoDB
1. Créer un compte sur [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Créer un cluster et obtenir l'URI de connexion
3. Configurer l'URI dans le fichier `.env`

### Démarrage
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## 🌐 Utilisation

### Accès aux Interfaces
- **Formulaire Employé** : `http://localhost:3000/`
- **Connexion Admin** : `http://localhost:3000/login.html`
- **Dashboard Admin** : `http://localhost:3000/admin-dashboard`

### Identifiants par Défaut
```
Nom d'utilisateur: admin
Mot de passe: admin123
```
⚠️ **Changez ces identifiants en production !**

## 📱 Installation PWA

1. Ouvrir l'application dans un navigateur compatible
2. Cliquer sur "Installer l'application" dans la barre d'adresse
3. Ou via le menu du navigateur > "Installer [Nom de l'app]"

## 🏗️ Architecture Technique

### Backend
- **Node.js + Express** : Serveur API REST
- **MongoDB + Mongoose** : Base de données avec schemas validés
- **JWT + bcryptjs** : Authentification sécurisée
- **PDFKit** : Génération de PDF fidèles au format original
- **Multer** : Gestion des signatures numériques

### Frontend
- **HTML5 + CSS3** : Interface responsive et moderne
- **JavaScript Vanilla** : Logique métier optimisée
- **Chart.js** : Graphiques interactifs
- **Service Worker** : Fonctionnalités hors-ligne
- **PWA** : Installation et notifications

### Données
- **Stockage principal** : MongoDB Atlas (cloud)
- **Fallback** : Mémoire locale si base indisponible
- **Signatures** : Fichiers PNG dans `/public/signatures/`
- **Exports** : PDF générés à la demande

## 📊 Fonctionnalités du Dashboard

### Statistiques
- Total des rapports soumis
- Nombre de véhicules actifs
- Conducteurs uniques
- Volume total de carburant distribué
- Évolution temporelle

### Gestion des Rapports
- Vue tabulaire avec tri et pagination
- Filtres par date, véhicule, statut
- Recherche textuelle multi-critères
- Sélection multiple pour actions groupées
- Détails complets avec signatures

### Exports
- **PDF individuel** : Rapport conforme au format original
- **PDF groupé** : Compilation de plusieurs rapports
- **CSV** : Données tabulaires pour Excel
- **Filtrage** : Export de sélections spécifiques

### Visualisations
- Graphique linéaire de l'évolution mensuelle
- Histogramme de consommation par véhicule
- Graphique circulaire de répartition par dépôt
- Contrôles de période (7 jours, 30 jours, 3 mois)

## 🚀 Déploiement en Production

### Plateformes Supportées
- **Vercel** (Recommandé) - Déploiement automatique
- **Heroku** - Plateforme cloud populaire
- **Railway** - Solution moderne et simple
- **DigitalOcean** - VPS avec plus de contrôle
- **AWS/Azure/GCP** - Solutions enterprise

### Variables d'Environnement Requises
```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=votre_secret_securise
PORT=3000
NODE_ENV=production
```

### Guide de Déploiement
Consultez `deployment-guide.md` pour les instructions détaillées de déploiement sur chaque plateforme.

## 🔧 Configuration Avancée

### Personnalisation
- **Logo et couleurs** : Modifier `/css/admin.css` et `/css/auth.css`
- **Champs formulaire** : Adapter les schemas dans `server.js`
- **Validations** : Ajuster les règles de validation
- **Exports PDF** : Personnaliser le layout dans la route PDF

### Sécurité Renforcée
```bash
# Ajouter le rate limiting
npm install express-rate-limit

# Sécuriser les headers
npm install helmet

# Monitoring et logs
npm install winston
```

### Performance
- **Compression gzip** automatique
- **Cache statique** pour les assets
- **Optimisation des requêtes** MongoDB
- **Pagination intelligente** côté serveur

## 📈 Monitoring et Maintenance

### Health Check
- Endpoint `/health` pour vérifier le statut
- Monitoring de la connexion MongoDB
- Métriques de performance disponibles

### Backups
- Sauvegarde automatique MongoDB
- Rétention configurable des données
- Export manuel des signatures

### Logs
- Logs d'erreurs structurés
- Audit des connexions admin
- Traçabilité des actions utilisateur

## 🛠️ Développement

### Structure du Projet
```
offline-form-app/
├── server.js              # Serveur Express principal
├── package.json           # Dépendances et scripts
├── public/                 # Assets statiques
│   ├── css/               # Feuilles de style
│   ├── js/                # Scripts client
│   ├── *.html             # Pages de l'application
│   └── signatures/        # Signatures sauvegardées
├── deployment-guide.md    # Guide de déploiement
└── vercel.json           # Configuration Vercel
```

### Scripts Disponibles
```bash
npm start          # Démarrer en production
npm run dev        # Démarrer avec nodemon
npm install        # Installer les dépendances
npm audit fix      # Corriger les vulnérabilités
```

### API Endpoints
```
POST /api/forms                    # Soumettre un formulaire
POST /api/auth/login              # Connexion admin
GET  /api/auth/verify             # Vérifier le token
GET  /api/admin/stats             # Statistiques dashboard
GET  /api/admin/reports           # Liste des rapports
GET  /api/admin/reports/:id       # Détails d'un rapport
GET  /api/admin/reports/:id/pdf   # Export PDF
```

## 🤝 Support

### Problèmes Courants
1. **Erreur MongoDB** : Vérifier l'URI et les credentials
2. **Signatures manquantes** : Vérifier les permissions du dossier
3. **Export PDF échoué** : Vérifier PDFKit et les polices
4. **Token expiré** : Se reconnecter à l'interface admin

### Contact
- **Documentation** : Consultez les guides dans le projet
- **Issues** : Créer une issue GitHub pour les bugs
- **Améliorations** : Proposer des pull requests

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

**Développé avec ❤️ pour ETER**  
*Application de gestion des rapports journaliers - Version Production Ready*