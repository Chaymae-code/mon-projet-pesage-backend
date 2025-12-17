/**
 * Script pour tester le démarrage du backend avec les nouvelles routes
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification de la configuration du backend...\n');

// 1. Vérifier les fichiers nécessaires
const requiredFiles = [
  './src/routes/simulationRoutes.js',
  './src/controllers/simulationController.js',
  './src/services/simulationService.js',
  './src/models/SequencePesage.js',
  './src/utils/excelParser.js'
];

console.log('📁 Vérification des fichiers:');
let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MANQUANT`);
    allFilesExist = false;
  }
});

// 2. Vérifier le dossier uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('\n📁 Création du dossier uploads...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('  ✅ Dossier uploads créé');
} else {
  console.log('\n📁 Dossier uploads: ✅ Existe');
}

// 3. Tester l'import des modules
console.log('\n📦 Test des imports:');
try {
  const simulationRoutes = require('./src/routes/simulationRoutes');
  console.log('  ✅ simulationRoutes importé');
  
  const simulationController = require('./src/controllers/simulationController');
  console.log('  ✅ simulationController importé');
  
  const simulationService = require('./src/services/simulationService');
  console.log('  ✅ simulationService importé');
  
  const SequencePesage = require('./src/models/SequencePesage');
  console.log('  ✅ SequencePesage importé');
  
  const excelParser = require('./src/utils/excelParser');
  console.log('  ✅ excelParser importé');
  
} catch (error) {
  console.error(`  ❌ Erreur lors de l'import: ${error.message}`);
  console.error(`  Stack: ${error.stack}`);
  process.exit(1);
}

// 4. Tester l'intégration dans server.js
console.log('\n🔗 Test de l\'intégration dans server.js:');
try {
  // Simuler un serveur minimal pour tester les routes
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  const simulationRoutes = require('./src/routes/simulationRoutes');
  app.use('/api/simulation', simulationRoutes);
  
  console.log('  ✅ Routes de simulation intégrées');
  console.log('  ✅ Serveur Express configuré');
  
} catch (error) {
  console.error(`  ❌ Erreur lors de l'intégration: ${error.message}`);
  process.exit(1);
}

// 5. Vérifier les dépendances
console.log('\n📚 Vérification des dépendances:');
const packageJson = require('./package.json');
const requiredDeps = ['multer', 'xlsx', 'express', 'cors', 'mysql2', 'jsonwebtoken'];
requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`  ✅ ${dep} installé`);
  } else {
    console.log(`  ❌ ${dep} - MANQUANT`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('\n✅ Tous les fichiers et dépendances sont présents !');
  console.log('\n🚀 Le backend devrait démarrer correctement.');
  console.log('\n💡 Pour démarrer le serveur:');
  console.log('   cd backend');
  console.log('   npm start');
  console.log('   ou');
  console.log('   npm run dev');
} else {
  console.log('\n⚠️  Certains fichiers ou dépendances manquent.');
  console.log('   Vérifiez les erreurs ci-dessus.');
  process.exit(1);
}




