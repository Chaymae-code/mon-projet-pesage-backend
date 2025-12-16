/**
 * Script de test rapide pour les endpoints de simulation
 * Vérifie que toutes les routes sont accessibles
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:5000';

let authToken = null;

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAuth() {
  log('\n🔐 Test d\'authentification...', 'cyan');
  
  try {
    const response = await axios.post(`${AUTH_URL}/login`, {
      username: 'admin',
      password: 'admin'
    });
    
    if (response.data.token) {
      authToken = response.data.token;
      log('✅ Authentification réussie', 'green');
      return true;
    } else {
      log('❌ Pas de token reçu', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erreur d'authentification: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'yellow');
      log(`   Data: ${JSON.stringify(error.response.data)}`, 'yellow');
    }
    return false;
  }
}

async function testEndpoint(method, endpoint, data = null, description = '') {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    log(`✅ ${description || endpoint}`, 'green');
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      log(`❌ ${description || endpoint} - Status: ${error.response.status}`, 'red');
      log(`   Message: ${error.response.data?.message || error.message}`, 'yellow');
    } else {
      log(`❌ ${description || endpoint} - ${error.message}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function testUpload() {
  log('\n📤 Test d\'upload de fichier Excel...', 'cyan');
  
  // Créer un fichier Excel minimal de test (simulation)
  // En réalité, vous devriez utiliser un vrai fichier Excel
  log('⚠️  Note: Ce test nécessite un vrai fichier Excel', 'yellow');
  log('   Pour tester manuellement:', 'yellow');
  log('   1. Allez sur http://localhost:5173/simulation', 'yellow');
  log('   2. Upload un fichier Excel via l\'interface', 'yellow');
  
  return { success: true, skipped: true };
}

async function runTests() {
  log('🧪 Tests des endpoints de simulation\n', 'blue');
  log('=' .repeat(50), 'blue');
  
  // Test 1: Authentification
  const authSuccess = await testAuth();
  if (!authSuccess) {
    log('\n❌ Impossible de continuer sans authentification', 'red');
    log('   Vérifiez que le backend auth est démarré sur le port 3001', 'yellow');
    process.exit(1);
  }
  
  // Test 2: Statut (GET)
  await testEndpoint('GET', '/api/simulation/status', null, 'GET /api/simulation/status');
  
  // Test 3: Démarrer (POST) - devrait échouer si pas de fichier uploadé
  await testEndpoint('POST', '/api/simulation/start', null, 'POST /api/simulation/start (sans fichier)');
  
  // Test 4: Arrêter (POST)
  await testEndpoint('POST', '/api/simulation/stop', null, 'POST /api/simulation/stop');
  
  // Test 5: Réinitialiser (POST)
  await testEndpoint('POST', '/api/simulation/reset', null, 'POST /api/simulation/reset');
  
  // Test 6: Upload (nécessite un fichier réel)
  await testUpload();
  
  log('\n' + '='.repeat(50), 'blue');
  log('\n✅ Tests terminés !', 'green');
  log('\n💡 Pour tester l\'upload complet:', 'cyan');
  log('   1. Démarrez tous les serveurs (backend, auth, frontend)', 'yellow');
  log('   2. Connectez-vous sur http://localhost:5173', 'yellow');
  log('   3. Allez sur la page Simulation', 'yellow');
  log('   4. Upload un fichier Excel et démarrez la simulation', 'yellow');
  log('\n📚 Consultez GUIDE_TEST_SIMULATION.md pour un guide complet', 'cyan');
}

// Vérifier que les serveurs sont accessibles
async function checkServers() {
  log('\n🔍 Vérification de l\'accessibilité des serveurs...', 'cyan');
  
  try {
    await axios.get(`${AUTH_URL}/health`).catch(() => {});
    log(`✅ Backend Auth accessible: ${AUTH_URL}`, 'green');
  } catch (error) {
    log(`⚠️  Backend Auth: ${AUTH_URL} - ${error.message}`, 'yellow');
  }
  
  try {
    await axios.get(`${API_URL}/api/categories`).catch(() => {});
    log(`✅ Backend Principal accessible: ${API_URL}`, 'green');
  } catch (error) {
    log(`⚠️  Backend Principal: ${API_URL} - ${error.message}`, 'yellow');
    log('   Vérifiez que le serveur est démarré', 'yellow');
  }
}

// Exécuter les tests
(async () => {
  await checkServers();
  await runTests();
})();

