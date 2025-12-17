// ============================================
// SERVICE : TRANSFERT AUTOMATIQUE VERS HISTORIQUE
// ============================================
// Vérifie périodiquement les pesages COMPLETED
// et les transfère automatiquement vers l'historique

const { operationalPool } = require('../config/operationalDatabase');
const historicalTransferService = require('./historicalTransferService');

class AutoTransferService {
  constructor() {
    this.checkInterval = null;
    this.checkIntervalMs = 5000; // Vérifie toutes les 5 secondes
    this.processedWeighings = new Set(); // Pour éviter les doublons
  }

  /**
   * Démarre le service de transfert automatique
   */
  start() {
    console.log('🚀 Démarrage du service de transfert automatique vers l\'historique...');
    
    // Vérifier immédiatement
    this.checkAndTransfer();
    
    // Vérifier périodiquement
    this.checkInterval = setInterval(() => {
      this.checkAndTransfer();
    }, this.checkIntervalMs);
    
    console.log(`✅ Service de transfert automatique démarré (vérification toutes les ${this.checkIntervalMs}ms)`);
  }

  /**
   * Arrête le service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.processedWeighings.clear();
    console.log('🛑 Service de transfert automatique arrêté');
  }

  /**
   * Vérifie et transfère les pesages COMPLETED
   */
  async checkAndTransfer() {
    try {
      // Récupérer tous les pesages COMPLETED qui n'ont pas encore été traités
      const [completedWeighings] = await operationalPool.query(
        `SELECT id_weighing, ticket_number, completion_time
         FROM active_weighings 
         WHERE current_state = 'COMPLETED'
           AND tare IS NOT NULL
           AND brut IS NOT NULL
           AND net IS NOT NULL
           AND ticket_number IS NOT NULL
         ORDER BY completion_time DESC
         LIMIT 10`
      );

      if (completedWeighings.length === 0) {
        return; // Aucun pesage à transférer
      }

      for (const weighing of completedWeighings) {
        // Éviter de traiter plusieurs fois le même pesage
        if (this.processedWeighings.has(weighing.id_weighing)) {
          continue;
        }

        // Vérifier si déjà transféré (en vérifiant dans l'historique)
        try {
          const { historicalPool } = require('../config/historicalDatabase');
          const [existing] = await historicalPool.query(
            'SELECT id FROM pesages WHERE ticket = ? LIMIT 1',
            [weighing.ticket_number]
          );

          if (existing.length > 0) {
            // Déjà transféré, marquer comme traité
            this.processedWeighings.add(weighing.id_weighing);
            continue;
          }
        } catch (err) {
          console.warn(`⚠️  Erreur vérification doublon pour ${weighing.id_weighing}:`, err.message);
        }

        // Transférer
        console.log(`🔄 [${weighing.id_weighing}] Transfert automatique vers l'historique...`);
        const result = await historicalTransferService.transferCompletedWeighing(weighing.id_weighing);
        
        if (result.success) {
          this.processedWeighings.add(weighing.id_weighing);
          if (result.existing) {
            console.log(`✅ [${weighing.id_weighing}] Déjà présent dans l'historique`);
          } else {
            console.log(`✅ [${weighing.id_weighing}] Transféré avec succès (ID historique: ${result.historicalId})`);
          }
        } else {
          console.warn(`⚠️  [${weighing.id_weighing}] Échec transfert: ${result.message}`);
          // Ne pas marquer comme traité en cas d'erreur pour réessayer plus tard
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors de la vérification automatique:', error);
    }
  }
}

// Instance singleton
let autoTransferInstance = null;

/**
 * Démarre le service de transfert automatique
 */
function startAutoTransferService() {
  if (!autoTransferInstance) {
    autoTransferInstance = new AutoTransferService();
    autoTransferInstance.start();
  }
  return autoTransferInstance;
}

/**
 * Arrête le service de transfert automatique
 */
function stopAutoTransferService() {
  if (autoTransferInstance) {
    autoTransferInstance.stop();
    autoTransferInstance = null;
  }
}

module.exports = {
  startAutoTransferService,
  stopAutoTransferService,
  getAutoTransferService: () => autoTransferInstance
};


