/**
 * Script pour mettre à jour l'ENUM statut
 * Usage: node update-statut-enum.js
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function updateStatutEnum() {
  console.log('🔄 Mise à jour de l\'ENUM statut...\n');
  
  try {
    // Modifier l'ENUM pour inclure toutes les valeurs
    const sql = `
      ALTER TABLE pesages 
      MODIFY COLUMN statut ENUM(
        'EN_ATTENTE', 
        'PREMIER_MESURE', 
        'EN_ZONE', 
        'DEUXIEME_MESURE', 
        'TARE_MESUREE', 
        'BRUT_MESURE', 
        'COMPLET', 
        'ANNULE'
      ) DEFAULT 'EN_ATTENTE' 
      COMMENT 'Statut du pesage dans la séquence industrielle'
    `;
    
    await pool.query(sql);
    console.log('✅ ENUM statut mis à jour avec succès !');
    console.log('📋 Nouvelles valeurs : EN_ATTENTE, PREMIER_MESURE, EN_ZONE, DEUXIEME_MESURE, TARE_MESUREE, BRUT_MESURE, COMPLET, ANNULE');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de l\'ENUM:', error.message);
    process.exit(1);
  }
}

updateStatutEnum();


