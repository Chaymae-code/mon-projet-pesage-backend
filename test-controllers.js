// test-controllers.js
console.log('🧪 TEST RAPIDE DES CONTRÔLEURS\n');

// Simule une requête et une réponse
const mockRequest = (params = {}, body = {}, query = {}) => ({
  params,
  body,
  query,
  originalUrl: '/test'
});

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    console.log('📤 Réponse simulée:', JSON.stringify(data, null, 2));
    return res;
  };
  return res;
};

// Test simple des contrôleurs
async function testControllers() {
  console.log('1. Test des modèles importés...');
  
  try {
    // Importe les contrôleurs
    const categorieCtrl = require('./src/controllers/categorieController');
    const produitCtrl = require('./src/controllers/produitController');
    const pesageCtrl = require('./src/controllers/pesageController');
    
    console.log('✅ Contrôleurs importés avec succès');
    
    console.log('\n2. Test de création d\'objets mock...');
    
    // Crée une requête/respons simulée
    const req = mockRequest();
    const res = mockResponse();
    
    console.log('✅ Objets mock créés');
    console.log('\n🎉 Les contrôleurs sont prêts à être utilisés !');
    console.log('\n⚠️  Attention: Ce test ne vérifie pas la connexion à la base.');
    console.log('   Pour tester vraiment, démarre le serveur avec: npm run dev');
    console.log('   Puis visite: http://localhost:5000/api/pesages');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.log('\n🔍 Vérifie:');
    console.log('   1. Les fichiers contrôleurs existent-ils ?');
    console.log('   2. Les chemins d\'import sont-ils corrects ?');
  }
}

testControllers();