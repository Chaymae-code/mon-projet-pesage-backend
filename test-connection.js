/**
 * Script de test pour vérifier la connexion frontend-backend
 * et l'état de la base de données
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function testConnection() {
  console.log('🔍 Test de connexion et diagnostic...\n');
  console.log('='.repeat(60));

  try {
    // 1. Test de connexion MySQL
    console.log('\n1️⃣ Test de connexion MySQL...');
    const connection = await pool.getConnection();
    console.log('✅ Connexion MySQL réussie !');
    connection.release();

    // 2. Vérifier si la base de données existe
    console.log('\n2️⃣ Vérification de la base de données...');
    const [databases] = await pool.query('SHOW DATABASES LIKE ?', [process.env.DB_NAME]);
    if (databases.length > 0) {
      console.log(`✅ Base de données "${process.env.DB_NAME}" existe`);
    } else {
      console.log(`❌ Base de données "${process.env.DB_NAME}" n'existe pas !`);
      return;
    }

    // 3. Vérifier si la table pesages existe
    console.log('\n3️⃣ Vérification de la table pesages...');
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pesages'
    `, [process.env.DB_NAME]);

    if (tables.length > 0) {
      console.log('✅ Table "pesages" existe');
    } else {
      console.log('❌ Table "pesages" n\'existe pas !');
      console.log('💡 Vous devez créer la table dans MySQL');
      return;
    }

    // 4. Compter les enregistrements
    console.log('\n4️⃣ Nombre d\'enregistrements dans la table pesages...');
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM pesages');
    const total = countResult[0].total;
    console.log(`📊 Total de pesages : ${total}`);

    if (total === 0) {
      console.log('⚠️  La table est VIDE - c\'est normal si vous venez de créer la base !');
      console.log('💡 Vous pouvez insérer des données de test (voir ci-dessous)');
    } else {
      console.log('✅ Des données existent dans la table');
    }

    // 5. Afficher la structure de la table
    console.log('\n5️⃣ Structure de la table pesages...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pesages'
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME]);

    console.log('\nColonnes de la table :');
    columns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
    });

    // 6. Vérifier les tables liées (produits, categories)
    console.log('\n6️⃣ Vérification des tables liées...');
    const [relatedTables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('produits', 'categories')
    `, [process.env.DB_NAME]);

    console.log('Tables liées trouvées :');
    relatedTables.forEach(table => {
      console.log(`   ✅ ${table.TABLE_NAME}`);
    });

    if (relatedTables.length < 2) {
      console.log('⚠️  Certaines tables liées manquent (produits, categories)');
    }

    // 7. Afficher quelques exemples de données si elles existent
    if (total > 0) {
      console.log('\n7️⃣ Aperçu des données (5 premiers enregistrements)...');
      const [samples] = await pool.query(`
        SELECT * FROM pesages 
        ORDER BY date_pesage DESC, heure DESC 
        LIMIT 5
      `);
      
      console.log('\nExemples :');
      samples.forEach((pesage, index) => {
        console.log(`\n   ${index + 1}. ID: ${pesage.id_pesage}`);
        console.log(`      Date: ${pesage.date_pesage}`);
        console.log(`      Camion: ${pesage.camion}`);
        console.log(`      Poids Net: ${pesage.net}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Diagnostic terminé !\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du diagnostic :');
    console.error(error.message);
    console.error('\n💡 Vérifiez :');
    console.error('   1. MySQL est démarré');
    console.error('   2. Les identifiants dans .env sont corrects');
    console.error('   3. La base de données existe');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();

