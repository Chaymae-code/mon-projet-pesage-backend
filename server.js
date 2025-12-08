// ============================================
// FICHIER PRINCIPAL : SERVER.JS
// Compatible Express 5 / Node 18+
// ============================================

// 1. IMPORTS DES MODULES
// ------------------------
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testConnection } = require('./src/config/database');

// ============================================
// IMPORT DES ROUTES
// ============================================
const categorieRoutes = require('./src/routes/categorieRoutes');
const produitRoutes = require('./src/routes/produitRoutes');
const pesageRoutes = require('./src/routes/pesageRoutes');

// Fonction pour obtenir l'IP - AJOUTE CECI
const os = require('os');
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIP = getLocalIPAddress();  // Cette ligne aussi

// 2. INITIALISATION DU SERVEUR
// -----------------------------
const app = express();
const PORT = process.env.PORT || 5000;

// 3. MIDDLEWARES (INTERMÉDIAIRES)
// --------------------------------
// Middleware CORS
//app.use(cors({
  //origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  //credentials: true
//}));

// 3. MIDDLEWARES (INTERMÉDIAIRES)
// --------------------------------

// Configuration CORS spéciale pour réseau local
app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (curl, Postman)
    if (!origin) return callback(null, true);
    
    // Liste des origines autorisées
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      `http://${localIP}:3000`,
      `http://10.24.144.46:3000`  // ← CHANGÉ ICI
    ];
    
    // Si l'origine est dans la liste
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Autoriser TOUTES les IPs du réseau 10.26.x.x (ton réseau)
    if (origin.startsWith('http://10.26.')) {
      console.log(`✅ CORS autorisé pour IP réseau: ${origin}`);
      return callback(null, true);
    }
    
    // Autoriser localhost sur n'importe quel port
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Refuser les autres
    console.log(`❌ CORS refusé: ${origin}`);
    return callback(new Error('Non autorisé par CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour parser les données de formulaires
app.use(express.urlencoded({ extended: true }));

// 4. ROUTES DE BASE
// ------------------
// Route racine : quand on visite http://localhost:5000/
// Route racine : quand on visite http://localhost:5000/
app.get('/', (req, res) => {
  res.json({
    message: '🎉 Bienvenue sur l\'API de gestion des pesages !',
    version: '1.0.0',
    status: '✅ Online',
    endpoints: {
      documentation: '/',
      health: '/health',
      categories: '/api/categories',
      produits: '/api/produits',
      pesages: '/api/pesages',
      stats: '/api/pesages/stats'
    },
    instructions: [
      'GET /api/categories - Liste des catégories',
      'GET /api/produits - Liste des produits',
      'GET /api/pesages - Liste des pesages',
      'GET /api/pesages/stats - Statistiques',
      'Utilise POST, PUT, DELETE pour modifier les données'
    ]
  });
});

// Route de santé (health check)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pesage-api',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ============================
// ROUTES DE L'API
// ============================
app.use('/api/categories', categorieRoutes);
app.use('/api/produits', produitRoutes);
app.use('/api/pesages', pesageRoutes);

// 5. GESTION DES ERREURS 404
// ---------------------------
// Middleware 404 - DOIT être placé APRÈS toutes les routes
// Syntaxe Express 5 : pas de '*' dans le chemin
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    requestedUrl: req.originalUrl,
    method: req.method,
    suggestion: 'Vérifie l\'URL ou consulte la documentation sur /',
    availableRoutes: ['GET /', 'GET /health']
  });
});

// 6. GESTIONNAIRE D'ERREURS GLOBAL
// ---------------------------------
// Middleware d'erreur avec 4 paramètres (err, req, res, next)
app.use((err, req, res, next) => {
  console.error('💥 Erreur non gérée:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// 7. DÉMARRAGE DU SERVEUR
// ------------------------
async function startServer() {
  console.log('🚀 Démarrage du serveur...');
  console.log('📋 Configuration détectée :');
  console.log(`   Port: ${PORT}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`   Base de données: ${process.env.DB_NAME}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Express: ${require('express/package.json').version}`);
  
  try {
    // Teste la connexion à la base de données
    console.log('🔌 Test de la connexion MySQL...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      console.log('💡 Astuces:');
      console.log('   1. Vérifie que MySQL est démarré');
      console.log('   2. Vérifie les identifiants dans le fichier .env');
      console.log('   3. Vérifie que la base "pesage_db" existe');
      console.log('   4. Vérifie le port MySQL (par défaut: 3306)');
      process.exit(1);
    }
    
    // Démarrer le serveur sur TOUTES les interfaces
    app.listen(PORT, '0.0.0.0', () => {  // ← '0.0.0.0' IMPORTANT !
      console.log('='.repeat(50));
      console.log(`✅ SERVEUR DÉMARRÉ AVEC SUCCÈS !`);
      console.log('='.repeat(50));
      console.log('🌐 URLs d\'accès (pour ton coéquipier) :');
      console.log(`   → Local:      http://localhost:${PORT}`);
      console.log(`   → Ton IP:     http://10.24.144.46:${PORT}`);  // ← CHANGÉ ICI
      console.log(`   → Réseau:     http://${localIP}:${PORT}`);
      console.log('='.repeat(50));
      console.log('📚 Endpoints à partager :');
      console.log(`   → GET  http://10.24.144.46:${PORT}/health`);  // ← CHANGÉ ICI
      console.log(`   → GET  http://10.24.144.46:${PORT}/api/pesages`);  // ← CHANGÉ ICI
      console.log(`   → POST http://10.24.144.46:${PORT}/api/pesages`);  // ← CHANGÉ ICI
      console.log('='.repeat(50));
      console.log('🤝 Partage cette info avec ton coéquipier :');
      console.log(`   URL Backend: http://10.24.144.46:${PORT}`);  // ← CHANGÉ ICI
      console.log('='.repeat(50));
    });
    
  } catch (error) {
    console.error('💥 Erreur critique au démarrage:', error);
    process.exit(1);
  }
}

// 8. GESTION DE L'ARRÊT PROPRE
// -----------------------------
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt gracieux du serveur...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Signal SIGTERM reçu, arrêt...');
  process.exit(0);
});

// Démarre le serveur
startServer();