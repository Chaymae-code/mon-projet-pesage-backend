// Script pour nettoyer les pesages actifs existants
require('dotenv').config();
const { operationalPool } = require('./src/config/operationalDatabase');

async function cleanup() {
  try {
    console.log('🧹 Nettoyage des pesages actifs pour 792A81...\n');
    
    // Supprimer les pesages actifs pour ce matricule
    const [result] = await operationalPool.query(
      'DELETE FROM active_weighings WHERE matricule = ?',
      ['792A81']
    );
    
    console.log(`✅ ${result.affectedRows} pesage(s) actif(s) supprimé(s)\n`);
    
    // Réinitialiser le statut de la planification
    const today = new Date().toISOString().split('T')[0];
    await operationalPool.query(
      'UPDATE daily_planning SET status = ? WHERE matricule = ? AND date_planning = ?',
      ['PENDING', '792A81', today]
    );
    
    console.log('✅ Statut de la planification réinitialisé à PENDING\n');
    console.log('✅ Nettoyage terminé. Vous pouvez maintenant tester à nouveau.\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await operationalPool.end();
  }
}

cleanup();




