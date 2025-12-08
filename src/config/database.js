// Importe le module mysql2 (version avec Promises)
const mysql = require('mysql2/promise');
// Charge les variables du fichier .env
require('dotenv').config();

// Crée un "pool" de connexions
const pool = mysql.createPool({
  host: process.env.DB_HOST,          // Où est MySQL ? (localhost)
  user: process.env.DB_USER,          // Qui es-tu ? (root)
  password: process.env.DB_PASSWORD,  // Ton mot de passe
  database: process.env.DB_NAME,      // Quelle base ? (pesage_db)
  port: process.env.DB_PORT,          // Sur quel port ? (3306)
  waitForConnections: true,           // Attendre si pas de connexion libre
  connectionLimit: 10,                // Max 10 connexions simultanées
  queueLimit: 0                       // Pas de limite d'attente
});

// Fonction pour tester la connexion
async function testConnection() {
  try {
    // Essaie d'obtenir une connexion du pool
    const connection = await pool.getConnection();
    console.log('✅ Connecté à MySQL avec succès !');
    // Libère la connexion (très important !)
    connection.release();
    return true;
  } catch (error) {
    // Si erreur, affiche le message
    console.error('❌ Erreur de connexion MySQL:', error.message);
    console.log('🔍 Vérifie :');
    console.log('  1. MySQL est-il démarré ?');
    console.log('  2. Les identifiants dans .env sont-ils corrects ?');
    console.log('  3. La base "pesage_db" existe-t-elle ?');
    return false;
  }
}

// Exporte le pool et la fonction de test
module.exports = { pool, testConnection };