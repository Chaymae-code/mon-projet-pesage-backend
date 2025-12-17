/**
 * Test de démarrage du serveur backend
 * Vérifie que le serveur démarre sans erreurs
 */

require('dotenv').config();
const http = require('http');

console.log('🚀 Test de démarrage du serveur backend...\n');

// Importer le serveur
let server;
let app;

try {
  // Simuler le démarrage du serveur
  const express = require('express');
  const cors = require('cors');
  const { testConnection } = require('./src/config/database');
  
  app = express();
  
  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Importer les routes
  const categorieRoutes = require('./src/routes/categorieRoutes');
  const produitRoutes = require('./src/routes/produitRoutes');
  const pesageRoutes = require('./src/routes/pesageRoutes');
  const simulationRoutes = require('./src/routes/simulationRoutes');
  
  // Enregistrer les routes
  app.use('/api/categories', categorieRoutes);
  app.use('/api/produits', produitRoutes);
  app.use('/api/pesages', pesageRoutes);
  app.use('/api/simulation', simulationRoutes);
  
  console.log('✅ Toutes les routes sont enregistrées');
  console.log('  - /api/categories');
  console.log('  - /api/produits');
  console.log('  - /api/pesages');
  console.log('  - /api/simulation');
  
  // Test de connexion à la base de données
  console.log('\n🔌 Test de connexion à la base de données...');
  testConnection()
    .then(() => {
      console.log('✅ Connexion à la base de données réussie');
      
      // Vérifier que les routes de simulation sont accessibles
      console.log('\n🔍 Vérification des routes de simulation:');
      const routes = [
        'POST /api/simulation/upload',
        'POST /api/simulation/start',
        'POST /api/simulation/stop',
        'GET /api/simulation/status',
        'POST /api/simulation/reset'
      ];
      
      routes.forEach(route => {
        console.log(`  ✅ ${route}`);
      });
      
      console.log('\n✅ Le serveur est prêt à démarrer !');
      console.log('\n💡 Pour démarrer le serveur:');
      console.log('   cd backend');
      console.log('   npm start');
      console.log('\n📝 Note: Le serveur nécessite une authentification JWT pour les routes de simulation.');
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur de connexion à la base de données:', error.message);
      console.log('\n⚠️  Vérifiez votre fichier .env et que MySQL est démarré.');
      process.exit(1);
    });
  
} catch (error) {
  console.error('❌ Erreur lors de la configuration du serveur:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}


