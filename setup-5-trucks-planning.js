// ============================================
// SCRIPT : Configuration Planification 5 Camions
// ============================================
// Ajoute automatiquement 5 camions dans la planification pour tester
// le système avec plusieurs camions simultanés

require('dotenv').config();
const mysql = require('mysql2/promise');

async function setup5TrucksPlanning() {
  console.log('🔧 Configuration de la planification pour 5 camions...\n');
  
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
        ['ATM', 1000.000, 0.000, false]
      );
      console.log('✅ Quota client ATM créé\n');
    } else {
      console.log(`✅ Quota client ATM existe déjà\n`);
    }
    
    // 3. Supprimer les anciennes planifications d'aujourd'hui
    console.log('📋 Étape 3 : Nettoyage des anciennes planifications...');
    const today = new Date().toISOString().split('T')[0];
    await operationalPool.query(
      'DELETE FROM daily_planning WHERE date_planning = ?',
      [today]
    );
    console.log('✅ Anciennes planifications supprimées\n');
    
    // 4. Ajouter 5 camions dans la planification
    console.log('📋 Étape 4 : Ajout de 5 camions dans la planification...');
    
    // 5 camions pour simulation simultanée
    const trucks = [
      { matricule: '792A81', driver: 'Ahmed Benali', quantity: 30.0 },
      { matricule: '123AB45', driver: 'Mohamed Alami', quantity: 25.0 },
      { matricule: '678CD90', driver: 'Fatima Zahra', quantity: 28.0 },
      { matricule: '456EF12', driver: 'Hassan Idrissi', quantity: 32.0 },
      { matricule: '789GH34', driver: 'Aicha Bensaid', quantity: 27.0 }
    ];
    
    // Utiliser l'heure actuelle pour tous les camions (arrivée simultanée)
    const now = new Date();
    const scheduledTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    
    for (let i = 0; i < trucks.length; i++) {
      const truck = trucks[i];
      
      await operationalPool.query(
        `INSERT INTO daily_planning 
         (date_planning, matricule, driver_name, client_name, id_produit, operation_type, planned_quantity, scheduled_time, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          today,
          truck.matricule,
          truck.driver,
          'ATM',
          product.id_produit,
          'LOADING',
          truck.quantity,
          scheduledTime,
          'PENDING'
        ]
      );
      
      console.log(`   ✅ ${truck.matricule} - ${truck.driver}`);
    }
    
    console.log('\n✅ 5 camions ajoutés dans la planification\n');
    
    // 5. Vérifier que tout est correct
    console.log('📋 Étape 5 : Vérification...');
    const [planning] = await operationalPool.query(
      `SELECT * FROM daily_planning 
       WHERE date_planning = ? AND status = 'PENDING'
       ORDER BY scheduled_time ASC`,
      [today]
    );
    
    if (planning.length === 5) {
      console.log('✅ Planification vérifiée :');
      planning.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.matricule} - ${p.driver_name} (${p.scheduled_time})`);
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ CONFIGURATION TERMINÉE AVEC SUCCÈS !');
      console.log('='.repeat(60));
      console.log('\n📝 5 camions ajoutés dans la planification :');
      planning.forEach((p, index) => {
        console.log(`   ${index + 1}. ${p.matricule}`);
      });
      console.log('\n💡 Pour tester avec 5 camions simultanés :');
      console.log('   1. Démarrez le backend: cd backend && npm start');
      console.log('   2. Ouvrez OpenCV en mode manuel:');
      console.log('      cd opencv_service');
      console.log('      python opencv_service.py --source 0 --no-ocr');
      console.log('   3. Appuyez sur T et entrez les 5 matricules une par une :');
      planning.forEach((p, index) => {
        console.log(`      - ${p.matricule}`);
      });
      console.log('\n   Les 5 camions apparaîtront simultanément sur le dashboard !\n');
    } else {
      console.error(`❌ Erreur : ${planning.length} planifications trouvées au lieu de 5`);
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
setup5TrucksPlanning();

