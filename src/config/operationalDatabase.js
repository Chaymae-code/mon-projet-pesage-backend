// ============================================
// CONFIGURATION : BASE DE DONNÉES OPÉRATIONNELLE
// ============================================
// Gère la connexion à la base opérationnelle (pesage_operational)
// Cette base est SÉPARÉE de la base historique (pesage_db)

require('dotenv').config();
const mysql = require('mysql2/promise');

// Configuration de la connexion
const operationalConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'pesage_operational', // Base opérationnelle
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Création du pool de connexions
const operationalPool = mysql.createPool(operationalConfig);

/**
 * Teste la connexion à la base opérationnelle
 */
async function testOperationalConnection() {
  try {
    const [rows] = await operationalPool.query('SELECT 1 as test');
    console.log('✅ Connexion à la base opérationnelle réussie');
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base opérationnelle:', error.message);
    return false;
  }
}

/**
 * Vérifie que les tables nécessaires existent
 */
async function verifyOperationalTables() {
  try {
    const [tables] = await operationalPool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'pesage_operational'
      AND TABLE_NAME IN ('daily_planning', 'active_weighings', 'client_quotas')
    `);
    
    const tableNames = tables.map(t => t.TABLE_NAME);
    const requiredTables = ['daily_planning', 'active_weighings', 'client_quotas'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.error(`❌ Tables manquantes: ${missingTables.join(', ')}`);
      console.error('⚠️  Veuillez exécuter la migration 003_create_operational_database.sql');
      return false;
    }
    
    console.log('✅ Toutes les tables opérationnelles sont présentes');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des tables:', error.message);
    return false;
  }
}

// Test de connexion au démarrage (optionnel)
if (process.env.NODE_ENV !== 'test') {
  testOperationalConnection().then(success => {
    if (success) {
      verifyOperationalTables();
    }
  });
}

module.exports = {
  operationalPool,
  testOperationalConnection,
  verifyOperationalTables
};
