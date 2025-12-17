// ============================================
// CONFIGURATION : BASE DE DONNÉES HISTORIQUE
// ============================================
// Configuration pour la base pesage_data (nouvelle base raffinée)
// Utilisée pour stocker les pesées terminées

const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions pour pesage_data
const historicalPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_HISTORICAL_NAME || 'pesage_data',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Teste la connexion à la base historique
 */
async function testHistoricalConnection() {
  try {
    const connection = await historicalPool.getConnection();
    console.log('✅ Connecté à la base historique (pesage_data) avec succès !');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base historique:', error.message);
    console.log('🔍 Vérifie :');
    console.log('  1. MySQL est-il démarré ?');
    console.log('  2. La base "pesage_data" existe-t-elle ?');
    console.log('  3. Les identifiants dans .env sont-ils corrects ?');
    return false;
  }
}

module.exports = {
  historicalPool,
  testHistoricalConnection
};



