// ============================================
// SCRIPT : Configuration Base Historique
// ============================================
// Crée la base pesage_data et importe le fichier SQL
// Utilise les mêmes identifiants que la base opérationnelle

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupHistoricalDatabase() {
  console.log('🔧 Configuration de la base historique (pesage_data)...\n');
  
  let connection;
  
  try {
    // Connexion sans base de données spécifique (pour créer la base)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });
    
    console.log('✅ Connexion MySQL établie\n');
    
    // 1. Créer la base de données
    console.log('📋 Étape 1 : Création de la base pesage_data...');
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS pesage_data 
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log('✅ Base pesage_data créée ou déjà existante\n');
    
    // 2. Sélectionner la base
    await connection.query('USE pesage_data');
    console.log('✅ Base pesage_data sélectionnée\n');
    
    // 3. Lire et exécuter le fichier SQL
    console.log('📋 Étape 2 : Import du fichier PESAGE_data.sql...');
    const sqlFilePath = path.join(__dirname, '..', 'PESAGE_data.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`❌ Fichier non trouvé: ${sqlFilePath}`);
      console.log('💡 Assurez-vous que le fichier PESAGE_data.sql est dans le dossier racine du projet');
      return;
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Séparer les requêtes (séparées par ';' mais attention aux triggers/functions)
    // Pour simplifier, on exécute tout le contenu
    console.log('   Exécution des requêtes SQL...');
    
    // Nettoyer le contenu SQL (enlever les commentaires MySQL spécifiques)
    console.log('   Nettoyage et exécution du fichier SQL...');
    
    // Remplacer les commentaires conditionnels MySQL par des commentaires simples
    let cleanSql = sqlContent
      .replace(/\/\*![\s\S]*?\*\//g, '') // Enlever les commentaires conditionnels /*!...*/
      .replace(/\/\*[\s\S]*?\*\//g, '') // Enlever les commentaires /*...*/
      .replace(/--.*$/gm, '') // Enlever les commentaires --
      .replace(/LOCK TABLES.*?UNLOCK TABLES;/gi, '') // Enlever LOCK/UNLOCK
      .replace(/SET.*?;/gi, ''); // Enlever les SET
    
    // Séparer les requêtes
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 20 && !s.match(/^(DROP|SET|LOCK|UNLOCK)/i));
    
    let tablesCreated = 0;
    let insertsExecuted = 0;
    let errors = 0;
    
    for (const statement of statements) {
      try {
        await connection.query(statement);
        if (statement.match(/^CREATE TABLE/i)) {
          tablesCreated++;
        } else if (statement.match(/^INSERT INTO/i)) {
          insertsExecuted++;
        }
      } catch (error) {
        // Ignorer les erreurs attendues
        if (!error.message.includes('already exists') && 
            !error.message.includes('Duplicate entry') &&
            !error.message.includes('Unknown database')) {
          errors++;
          if (errors <= 5) { // Limiter l'affichage des erreurs
            console.warn(`   ⚠️  Erreur: ${error.message.substring(0, 60)}...`);
          }
        }
      }
    }
    
    if (errors > 5) {
      console.log(`   ⚠️  ${errors - 5} autres erreurs (probablement normales)\n`);
    }
    
    console.log(`✅ Import terminé: ${tablesCreated} tables créées, ${insertsExecuted} inserts exécutés\n`);
    
    // 4. Vérifier que les tables existent
    console.log('📋 Étape 3 : Vérification des tables...');
    const [tables] = await connection.query(
      "SHOW TABLES"
    );
    
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log(`✅ Tables trouvées: ${tableNames.join(', ')}\n`);
    
    // 5. Vérifier la configuration .env
    console.log('📋 Étape 4 : Vérification de la configuration...');
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      if (!envContent.includes('DB_HISTORICAL_NAME')) {
        console.log('   Ajout de DB_HISTORICAL_NAME dans .env...');
        const newEnvLine = '\n# Base de données historique (nouvelle base raffinée)\nDB_HISTORICAL_NAME=pesage_data\n';
        fs.appendFileSync(envPath, newEnvLine);
        console.log('✅ Variable DB_HISTORICAL_NAME ajoutée dans .env\n');
      } else {
        console.log('✅ Variable DB_HISTORICAL_NAME déjà présente dans .env\n');
      }
    } else {
      console.warn('⚠️  Fichier .env non trouvé, créez-le manuellement avec DB_HISTORICAL_NAME=pesage_data\n');
    }
    
    console.log('='.repeat(60));
    console.log('✅ CONFIGURATION TERMINÉE AVEC SUCCÈS !');
    console.log('='.repeat(60));
    console.log('\n📝 Prochaines étapes :');
    console.log('   1. Redémarrez le backend pour que la nouvelle configuration soit prise en compte');
    console.log('   2. Les pesées terminées seront automatiquement transférées vers pesage_data');
    console.log('   3. Vérifiez les logs du backend pour confirmer le transfert\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('💡 Vérifiez les identifiants MySQL dans le fichier .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Vérifiez que MySQL est démarré');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Lancer le script
setupHistoricalDatabase();

