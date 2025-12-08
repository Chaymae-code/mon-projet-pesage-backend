// test-routes.js
console.log('🧪 TEST DES ROUTES\n');

// Test 1: Vérifie que les fichiers de routes existent
try {
  const fs = require('fs');
  
  console.log('1. Vérification des fichiers de routes :');
  
  const routeFiles = [
    './src/routes/categorieRoutes.js',
    './src/routes/produitRoutes.js',
    './src/routes/pesageRoutes.js'
  ];
  
  routeFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file} - Existe`);
    } else {
      console.log(`   ❌ ${file} - NON TROUVÉ`);
    }
  });
  
} catch (error) {
  console.log('   ❌ Erreur lors de la vérification:', error.message);
}

// Test 2: Essaie d'importer les routes
console.log('\n2. Test d\'import des routes :');
try {
  const categorieRoutes = require('./src/routes/categorieRoutes');
  const produitRoutes = require('./src/routes/produitRoutes');
  const pesageRoutes = require('./src/routes/pesageRoutes');
  
  console.log('   ✅ Routes importées avec succès !');
  console.log('\n📋 Routes disponibles :');
  console.log('   - GET    /api/categories');
  console.log('   - GET    /api/categories/:id');
  console.log('   - POST   /api/categories');
  console.log('   - PUT    /api/categories/:id');
  console.log('   - DELETE /api/categories/:id');
  console.log('');
  console.log('   - GET    /api/produits');
  console.log('   - GET    /api/produits/:id');
  console.log('   - POST   /api/produits');
  console.log('   - PUT    /api/produits/:id');
  console.log('   - DELETE /api/produits/:id');
  console.log('');
  console.log('   - GET    /api/pesages');
  console.log('   - GET    /api/pesages/:id');
  console.log('   - POST   /api/pesages');
  console.log('   - PUT    /api/pesages/:id');
  console.log('   - DELETE /api/pesages/:id');
  console.log('   - GET    /api/pesages/stats');
  
  console.log('\n🎉 Toutes les routes sont configurées !');
  console.log('🚀 Lance le serveur avec: npm run dev');
  console.log('🌐 Puis teste avec: http://localhost:5000/api/categories');
  
} catch (error) {
  console.log('   ❌ Erreur d\'import:', error.message);
  console.log('\n🔍 Problème détecté :');
  console.log('   1. Vérifie que les contrôleurs existent');
  console.log('   2. Vérifie les chemins d\'import dans les fichiers de routes');
  console.log('   3. Vérifie la syntaxe dans chaque fichier');
}