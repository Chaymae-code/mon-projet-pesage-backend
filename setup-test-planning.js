// ============================================
// SCRIPT : Configuration Planification de Test
// ============================================
// Ajoute automatiquement une planification pour tester OpenCV

require('dotenv').config();
const mysql = require('mysql2/promise');

async function setupTestPlanning() {
  console.log('🔧 Configuration de la planification de test...\n');
  
  let historicalPool, operationalPool;
  
  try {
    // Connexion à la base historique
    historicalPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'pesage_db',
      waitForConnections: true,
      connectionLimit: 10
    });
    
    // Connexion à la base opérationnelle
    operationalPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: 'pesage_operational',
      waitForConnections: true,
      connectionLimit: 10
    });
    
    console.log('✅ Connexions aux bases de données établies\n');
    
    // 1. Récupérer un produit existant
    console.log('📋 Étape 1 : Recherche d\'un produit...');
    const [products] = await historicalPool.query(
      'SELECT id_produit, nom_produit FROM produits LIMIT 1'
    );
    
    if (products.length === 0) {
      console.error('❌ Aucun produit trouvé dans la base historique');
      console.log('💡 Veuillez d\'abord créer des produits dans pesage_db.produits');
      return;
    }
    
    const product = products[0];
    console.log(`✅ Produit trouvé: ${product.nom_produit} (ID: ${product.id_produit})\n`);
    
    // 2. Vérifier/ajouter le quota client
    console.log('📋 Étape 2 : Vérification du quota client...');
    const [quotas] = await operationalPool.query(
      'SELECT * FROM client_quotas WHERE client_name = ?',
      ['ATM']
    );
    
    if (quotas.length === 0) {
      console.log('   Ajout du quota pour le client ATM...');
      await operationalPool.query(
        `INSERT INTO client_quotas (client_name, total_quota, consumed_quota, is_blocked)
         VALUES (?, ?, ?, ?)`,
        ['ATM', 500.000, 0.000, false]
      );
      console.log('✅ Quota client ATM créé\n');
    } else {
      console.log(`✅ Quota client ATM existe déjà (${quotas[0].remaining_quota}t restantes)\n`);
    }
    
    // 3. Supprimer l'ancienne planification si elle existe
    console.log('📋 Étape 3 : Nettoyage des anciennes planifications...');
    const today = new Date().toISOString().split('T')[0];
    await operationalPool.query(
      'DELETE FROM daily_planning WHERE matricule = ? AND date_planning = ?',
      ['792A81', today]
    );
    console.log('✅ Anciennes planifications supprimées\n');
    
    // 4. Ajouter la planification pour aujourd'hui
    console.log('📋 Étape 4 : Ajout de la planification pour aujourd\'hui...');
    await operationalPool.query(
      `INSERT INTO daily_planning 
       (date_planning, matricule, driver_name, client_name, id_produit, operation_type, planned_quantity, scheduled_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        today,
        '792A81',
        'Ahmed Benali',
        'ATM',
        product.id_produit,
        'LOADING',
        30.000,
        '10:00:00',
        'PENDING'
      ]
    );
    console.log('✅ Planification ajoutée\n');
    
    // 5. Vérifier que tout est correct
    console.log('📋 Étape 5 : Vérification...');
    const [planning] = await operationalPool.query(
      `SELECT * FROM daily_planning 
       WHERE matricule = ? AND date_planning = ? AND status = 'PENDING'`,
      ['792A81', today]
    );
    
    if (planning.length > 0) {
      const p = planning[0];
      console.log('✅ Planification vérifiée :');
      console.log(`   - Matricule: ${p.matricule}`);
      console.log(`   - Date: ${p.date_planning}`);
      console.log(`   - Client: ${p.client_name}`);
      console.log(`   - Produit ID: ${p.id_produit}`);
      console.log(`   - Opération: ${p.operation_type}`);
      console.log(`   - Statut: ${p.status}\n`);
      
      console.log('='.repeat(60));
      console.log('✅ CONFIGURATION TERMINÉE AVEC SUCCÈS !');
      console.log('='.repeat(60));
      console.log('\n📝 Vous pouvez maintenant tester OpenCV :');
      console.log('   cd opencv_service');
      console.log('   python opencv_service.py --source 0 --no-ocr\n');
    } else {
      console.error('❌ Erreur : La planification n\'a pas été trouvée après insertion');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Vérifiez que la base pesage_operational existe');
      console.error('   Exécutez la migration: backend/migrations/003_create_operational_database.sql');
    }
  } finally {
    if (historicalPool) await historicalPool.end();
    if (operationalPool) await operationalPool.end();
  }
}

// Lancer le script
setupTestPlanning();


