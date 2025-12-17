// ============================================
// SCRIPT : VÉRIFIER ET TRANSFÉRER LES PESAGES COMPLÉTÉS
// ============================================
// Vérifie les pesages COMPLETED dans active_weighings
// et les transfère vers la base historique si nécessaire

require('dotenv').config();
const { operationalPool } = require('./src/config/operationalDatabase');
const historicalTransferService = require('./src/services/historicalTransferService');

async function checkAndTransfer() {
  try {
    console.log('🔍 Vérification des pesages COMPLETED...\n');

    // 1. Récupérer tous les pesages COMPLETED
    const [completedWeighings] = await operationalPool.query(
      `SELECT 
        id_weighing,
        matricule,
        client_name,
        ticket_number,
        tare,
        brut,
        net,
        completion_time,
        current_state
      FROM active_weighings 
      WHERE current_state = 'COMPLETED'
      ORDER BY completion_time DESC`
    );

    console.log(`📊 ${completedWeighings.length} pesage(s) COMPLETED trouvé(s)\n`);

    if (completedWeighings.length === 0) {
      console.log('✅ Aucun pesage COMPLETED à transférer');
      return;
    }

    // 2. Afficher les détails
    console.log('📋 Détails des pesages COMPLETED:');
    completedWeighings.forEach((w, index) => {
      console.log(`\n${index + 1}. ID: ${w.id_weighing}`);
      console.log(`   Matricule: ${w.matricule}`);
      console.log(`   Client: ${w.client_name}`);
      console.log(`   Ticket: ${w.ticket_number}`);
      console.log(`   Tare: ${w.tare}t, Brut: ${w.brut}t, Net: ${w.net}t`);
      console.log(`   Date complétion: ${w.completion_time}`);
      console.log(`   État: ${w.current_state}`);
    });

    // 3. Tenter le transfert pour chacun
    console.log('\n\n🔄 Début du transfert...\n');
    let successCount = 0;
    let errorCount = 0;

    for (const weighing of completedWeighings) {
      console.log(`\n📤 Transfert du pesage ${weighing.id_weighing} (${weighing.matricule})...`);
      
      try {
        const result = await historicalTransferService.transferCompletedWeighing(weighing.id_weighing);
        
        if (result.success) {
          if (result.existing) {
            console.log(`   ✅ Déjà présent dans l'historique`);
          } else {
            console.log(`   ✅ Transféré avec succès (ID historique: ${result.historicalId})`);
            successCount++;
          }
        } else {
          console.log(`   ❌ Échec: ${result.message}`);
          if (result.error) {
            console.log(`   Détails: ${result.error.message}`);
          }
          errorCount++;
        }
      } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        errorCount++;
      }
    }

    // 4. Résumé
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DU TRANSFERT');
    console.log('='.repeat(60));
    console.log(`Total pesages COMPLETED: ${completedWeighings.length}`);
    console.log(`✅ Transférés avec succès: ${successCount}`);
    console.log(`⚠️  Déjà présents: ${completedWeighings.length - successCount - errorCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    process.exit(1);
  } finally {
    await operationalPool.end();
    process.exit(0);
  }
}

// Exécuter
checkAndTransfer();


