/**
 * Script pour vérifier que la migration a bien été appliquée
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/database');

async function verifyMigration() {
  try {
    console.log('🔍 Vérification de la migration...\n');
    
    const [rows] = await pool.query('DESCRIBE pesages');
    
    console.log('📋 Colonnes de la table pesages:');
    const newColumns = [
      'type_pesage',
      'premier_pesage',
      'deuxieme_pesage',
      'statut',
      'heure_premier_pesage',
      'heure_deuxieme_pesage',
      'delai_zone',
      'client',
      'direction'
    ];
    
    const existingColumns = rows.map(r => r.Field);
    const foundColumns = [];
    const missingColumns = [];
    
    newColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        foundColumns.push(col);
        const colInfo = rows.find(r => r.Field === col);
        console.log(`  ✅ ${col} (${colInfo.Type})`);
      } else {
        missingColumns.push(col);
        console.log(`  ❌ ${col} - MANQUANTE`);
      }
    });
    
    console.log(`\n📊 Résumé:`);
    console.log(`  ✅ Colonnes trouvées: ${foundColumns.length}/${newColumns.length}`);
    if (missingColumns.length > 0) {
      console.log(`  ❌ Colonnes manquantes: ${missingColumns.join(', ')}`);
    } else {
      console.log(`  🎉 Toutes les colonnes sont présentes !`);
    }
    
    // Vérifier les index
    console.log(`\n🔍 Vérification des index...`);
    const [indexes] = await pool.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pesages'
      AND INDEX_NAME LIKE 'idx_pesages_%'
    `);
    
    const expectedIndexes = ['idx_pesages_statut', 'idx_pesages_type_pesage', 'idx_pesages_client'];
    const foundIndexes = indexes.map(i => i.INDEX_NAME);
    
    expectedIndexes.forEach(idx => {
      if (foundIndexes.includes(idx)) {
        console.log(`  ✅ ${idx}`);
      } else {
        console.log(`  ❌ ${idx} - MANQUANT`);
      }
    });
    
    if (missingColumns.length === 0 && foundIndexes.length >= expectedIndexes.length) {
      console.log(`\n✅ Migration complète et vérifiée avec succès !`);
    } else {
      console.log(`\n⚠️  Certains éléments manquent. Relancez la migration si nécessaire.`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  } finally {
    await pool.end();
  }
}

verifyMigration();

