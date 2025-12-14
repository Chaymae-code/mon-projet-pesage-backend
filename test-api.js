/**
 * Script pour tester l'API directement (sans frontend)
 * Simule les requêtes que le frontend enverrait
 */

const axios = require('axios');

const BACKEND_AUTH_URL = 'http://localhost:3001';
const BACKEND_MAIN_URL = 'http://localhost:5000';

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAPI() {
  console.log('\n🧪 Test de l\'API Frontend-Backend\n');
  console.log('='.repeat(60));

  let token = null;

  try {
    // 1. Test de connexion au backend auth
    log('\n1️⃣ Test du backend d\'authentification...', 'blue');
    try {
      const healthAuth = await axios.get(`${BACKEND_AUTH_URL}/api/health`);
      log('✅ Backend Auth accessible', 'green');
      console.log('   Réponse:', healthAuth.data);
    } catch (error) {
      log('❌ Backend Auth non accessible', 'red');
      console.error('   Erreur:', error.message);
      console.error('   💡 Vérifiez que le backend auth tourne sur le port 3001');
      return;
    }

    // 2. Test de connexion au backend principal
    log('\n2️⃣ Test du backend principal...', 'blue');
    try {
      const healthMain = await axios.get(`${BACKEND_MAIN_URL}/health`);
      log('✅ Backend Principal accessible', 'green');
      console.log('   Réponse:', healthMain.data);
    } catch (error) {
      log('❌ Backend Principal non accessible', 'red');
      console.error('   Erreur:', error.message);
      console.error('   💡 Vérifiez que le backend principal tourne sur le port 5000');
      return;
    }

    // 3. Test de login
    log('\n3️⃣ Test de connexion (login)...', 'blue');
    try {
      const loginResponse = await axios.post(`${BACKEND_AUTH_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin'
      });
      
      token = loginResponse.data.token;
      log('✅ Connexion réussie !', 'green');
      console.log('   Utilisateur:', loginResponse.data.user.username);
      console.log('   Rôle:', loginResponse.data.user.role);
      console.log('   Token reçu:', token.substring(0, 20) + '...');
    } catch (error) {
      log('❌ Échec de la connexion', 'red');
      console.error('   Erreur:', error.response?.data || error.message);
      return;
    }

    // 4. Test d'accès aux pesages (sans token - devrait échouer)
    log('\n4️⃣ Test d\'accès aux pesages SANS token (devrait échouer)...', 'blue');
    try {
      await axios.get(`${BACKEND_MAIN_URL}/api/pesages`);
      log('⚠️  Accès autorisé sans token (problème de sécurité !)', 'yellow');
    } catch (error) {
      if (error.response?.status === 401) {
        log('✅ Protection JWT active (401 Unauthorized)', 'green');
      } else {
        log('❌ Erreur inattendue', 'red');
        console.error('   Erreur:', error.message);
      }
    }

    // 5. Test d'accès aux pesages (avec token - devrait réussir)
    log('\n5️⃣ Test d\'accès aux pesages AVEC token...', 'blue');
    try {
      const pesagesResponse = await axios.get(`${BACKEND_MAIN_URL}/api/pesages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      log('✅ Accès aux pesages réussi !', 'green');
      const data = pesagesResponse.data;
      console.log('   Structure de la réponse:', {
        success: data.success,
        count: data.count,
        hasData: Array.isArray(data.data) && data.data.length > 0
      });

      if (data.data && data.data.length > 0) {
        console.log(`\n   📊 ${data.data.length} pesage(s) trouvé(s)`);
        console.log('\n   Premier pesage :');
        const first = data.data[0];
        console.log('      ID:', first.id_pesage);
        console.log('      Date:', first.date_pesage);
        console.log('      Camion:', first.camion);
        console.log('      Produit:', first.nom_produit || 'N/A');
        console.log('      Poids Net:', first.net);
      } else {
        log('   ⚠️  Aucune donnée dans la table pesages', 'yellow');
        log('   💡 La table est vide - c\'est normal si vous venez de créer la base', 'yellow');
      }

    } catch (error) {
      log('❌ Échec d\'accès aux pesages', 'red');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Message:', error.response.data);
        
        if (error.response.status === 401) {
          log('   💡 Problème d\'authentification - vérifiez le JWT_SECRET', 'yellow');
        } else if (error.response.status === 500) {
          log('   💡 Erreur serveur - vérifiez les logs du backend', 'yellow');
        }
      } else {
        console.error('   Erreur:', error.message);
      }
      return;
    }

    // 6. Test des statistiques
    log('\n6️⃣ Test des statistiques...', 'blue');
    try {
      const statsResponse = await axios.get(`${BACKEND_MAIN_URL}/api/pesages/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      log('✅ Statistiques récupérées !', 'green');
      console.log('   Stats:', statsResponse.data);
    } catch (error) {
      log('⚠️  Impossible de récupérer les statistiques', 'yellow');
      console.error('   Erreur:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(60));
    log('\n✅ Tous les tests sont terminés !', 'green');
    log('\n💡 Résumé :', 'blue');
    log('   - Si tous les tests sont verts ✅ : La connexion fonctionne !', 'green');
    log('   - Si vous voyez "Aucune donnée" : La table pesages est vide (normal)', 'yellow');
    log('   - Si vous voyez des erreurs ❌ : Vérifiez les points mentionnés', 'red');

  } catch (error) {
    log('\n❌ Erreur générale lors des tests', 'red');
    console.error(error);
  }
}

// Vérifier si axios est installé
try {
  require('axios');
} catch (error) {
  console.error('❌ axios n\'est pas installé. Installez-le avec :');
  console.error('   npm install axios');
  process.exit(1);
}

testAPI();

