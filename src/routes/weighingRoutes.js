// ============================================
// ROUTES : WORKFLOW DE PESAGE
// ============================================
// Gère les transitions d'état et les mises à jour de poids

const express = require('express');
const router = express.Router();
const { operationalPool } = require('../config/operationalDatabase');

/**
 * POST /api/weighings/:id/entry
 * Démarre le pesage d'entrée (ARRIVAL → ENTRY_WEIGHING)
 */
router.post('/:id/entry', async (req, res) => {
  const weighingId = parseInt(req.params.id);
  
  try {
    // Vérifier que le pesage existe et est dans l'état ARRIVAL
    const [weighings] = await operationalPool.query(
      'SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1',
      [weighingId]
    );
    
    if (weighings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesage non trouvé'
      });
    }
    
    const weighing = weighings[0];
    
    if (weighing.current_state !== 'ARRIVAL') {
      return res.status(400).json({
        success: false,
        message: `Transition impossible : état actuel est ${weighing.current_state}, attendu ARRIVAL`
      });
    }
    
    // Mettre à jour l'état
    await operationalPool.query(
      `UPDATE active_weighings 
       SET current_state = 'ENTRY_WEIGHING', 
           entry_weighing_time = NOW(),
           updated_at = NOW()
       WHERE id_weighing = ?`,
      [weighingId]
    );
    
    console.log(`✅ Pesage ${weighingId} : ARRIVAL → ENTRY_WEIGHING`);
    
    // Émettre événement WebSocket
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.weighingStateChanged({
      weighing_id: weighingId,
      old_state: 'ARRIVAL',
      new_state: 'ENTRY_WEIGHING',
      matricule: weighing.matricule
    });
    
    res.json({
      success: true,
      message: 'Pesage d\'entrée démarré',
      weighing_id: weighingId,
      new_state: 'ENTRY_WEIGHING'
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors du démarrage du pesage d'entrée ${weighingId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/weighings/:id/weight-update
 * Met à jour le poids (depuis le calculateur)
 */
router.post('/:id/weight-update', async (req, res) => {
  const weighingId = parseInt(req.params.id);
  const { weight, stability } = req.body;
  
  if (weight === undefined || weight === null) {
    return res.status(400).json({
      success: false,
      message: 'Poids requis'
    });
  }
  
  try {
    // Récupérer le pesage actuel
    const [weighings] = await operationalPool.query(
      'SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1',
      [weighingId]
    );
    
    if (weighings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesage non trouvé'
      });
    }
    
    const weighing = weighings[0];
    const weightValue = parseFloat(weight);
    
    // Déterminer quel poids mettre à jour selon l'état
    let updateQuery = '';
    let updateParams = [];
    
    if (weighing.current_state === 'ENTRY_WEIGHING') {
      // Premier pesage : entry_weight
      updateQuery = `UPDATE active_weighings 
                     SET entry_weight = ?, updated_at = NOW()
                     WHERE id_weighing = ?`;
      updateParams = [weightValue, weighingId];
      
    } else if (weighing.current_state === 'EXIT_WEIGHING') {
      // Deuxième pesage : exit_weight
      updateQuery = `UPDATE active_weighings 
                     SET exit_weight = ?, updated_at = NOW()
                     WHERE id_weighing = ?`;
      updateParams = [weightValue, weighingId];
      
      // Si les deux poids sont disponibles, calculer tare/brut/net
      if (weighing.entry_weight !== null) {
        await calculateWeights(weighingId, weighing.entry_weight, weightValue, weighing.operation_type);
      }
    } else {
      return res.status(400).json({
        success: false,
        message: `Mise à jour de poids impossible dans l'état ${weighing.current_state}`
      });
    }
    
    await operationalPool.query(updateQuery, updateParams);
    
    // Si c'est la deuxième pesée, récupérer les poids calculés
    let tare = null, brut = null, net = null;
    if (weighing.current_state === 'EXIT_WEIGHING') {
      const [updatedWeighings] = await operationalPool.query(
        `SELECT tare, brut, net FROM active_weighings WHERE id_weighing = ? LIMIT 1`,
        [weighingId]
      );
      if (updatedWeighings.length > 0) {
        tare = updatedWeighings[0].tare;
        brut = updatedWeighings[0].brut;
        net = updatedWeighings[0].net;
      }
    }
    
    console.log(`✅ Poids mis à jour pour pesage ${weighingId}: ${weightValue}t (état: ${weighing.current_state})`);
    
    // Émettre événement WebSocket avec tous les poids
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.weightUpdated({
      weighing_id: weighingId,
      weight: weightValue,
      weight_type: weighing.current_state === 'ENTRY_WEIGHING' ? 'entry' : 'exit',
      stability: stability || 'UNSTABLE',
      matricule: weighing.matricule,
      tare: tare,
      brut: brut,
      net: net
    });
    
    res.json({
      success: true,
      message: 'Poids mis à jour',
      weighing_id: weighingId,
      weight: weightValue,
      stability: stability || 'UNSTABLE'
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour du poids ${weighingId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/weighings/:id/zone-entry
 * Transition vers LOADING ou UNLOADING
 */
router.post('/:id/zone-entry', async (req, res) => {
  const weighingId = parseInt(req.params.id);
  
  try {
    const [weighings] = await operationalPool.query(
      'SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1',
      [weighingId]
    );
    
    if (weighings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesage non trouvé'
      });
    }
    
    const weighing = weighings[0];
    
    if (weighing.current_state !== 'ENTRY_WEIGHING') {
      return res.status(400).json({
        success: false,
        message: `Transition impossible : état actuel est ${weighing.current_state}`
      });
    }
    
    // Déterminer le nouvel état selon operation_type
    const newState = weighing.operation_type === 'LOADING' ? 'LOADING' : 'UNLOADING';
    
    await operationalPool.query(
      `UPDATE active_weighings 
       SET current_state = ?, 
           zone_entry_time = NOW(),
           updated_at = NOW()
       WHERE id_weighing = ?`,
      [newState, weighingId]
    );
    
    console.log(`✅ Pesage ${weighingId} : ENTRY_WEIGHING → ${newState}`);
    
    // Émettre événement WebSocket
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.weighingStateChanged({
      weighing_id: weighingId,
      old_state: 'ENTRY_WEIGHING',
      new_state: newState,
      matricule: weighing.matricule
    });
    
    res.json({
      success: true,
      message: `Transition vers ${newState}`,
      weighing_id: weighingId,
      new_state: newState
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'entrée en zone ${weighingId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/weighings/:id/exit
 * Démarre le pesage de sortie (LOADING/UNLOADING → EXIT_WEIGHING)
 */
router.post('/:id/exit', async (req, res) => {
  const weighingId = parseInt(req.params.id);
  
  try {
    const [weighings] = await operationalPool.query(
      'SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1',
      [weighingId]
    );
    
    if (weighings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesage non trouvé'
      });
    }
    
    const weighing = weighings[0];
    
    if (weighing.current_state !== 'LOADING' && weighing.current_state !== 'UNLOADING') {
      return res.status(400).json({
        success: false,
        message: `Transition impossible : état actuel est ${weighing.current_state}`
      });
    }
    
    await operationalPool.query(
      `UPDATE active_weighings 
       SET current_state = 'EXIT_WEIGHING', 
           exit_weighing_time = NOW(),
           updated_at = NOW()
       WHERE id_weighing = ?`,
      [weighingId]
    );
    
    console.log(`✅ Pesage ${weighingId} : ${weighing.current_state} → EXIT_WEIGHING`);
    
    // Émettre événement WebSocket
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.weighingStateChanged({
      weighing_id: weighingId,
      old_state: weighing.current_state,
      new_state: 'EXIT_WEIGHING',
      matricule: weighing.matricule
    });
    
    res.json({
      success: true,
      message: 'Pesage de sortie démarré',
      weighing_id: weighingId,
      new_state: 'EXIT_WEIGHING'
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors du démarrage du pesage de sortie ${weighingId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/weighings/:id/complete
 * Finalise le pesage (EXIT_WEIGHING → COMPLETED)
 * Génère le ticket et décrémente le quota
 */
router.post('/:id/complete', async (req, res) => {
  const weighingId = parseInt(req.params.id);
  
  try {
    const [weighings] = await operationalPool.query(
      'SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1',
      [weighingId]
    );
    
    if (weighings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pesage non trouvé'
      });
    }
    
    const weighing = weighings[0];
    
    if (weighing.current_state !== 'EXIT_WEIGHING') {
      return res.status(400).json({
        success: false,
        message: `Finalisation impossible : état actuel est ${weighing.current_state}`
      });
    }
    
    // Vérifier que les poids sont disponibles
    if (weighing.entry_weight === null || weighing.exit_weight === null) {
      return res.status(400).json({
        success: false,
        message: 'Les poids d\'entrée et de sortie doivent être renseignés'
      });
    }
    
    // Générer le numéro de ticket séquentiel
    const { generateNextTicketNumber } = require('../utils/ticketGenerator');
    const ticketNumber = await generateNextTicketNumber();
    
    // Finaliser le pesage
    await operationalPool.query(
      `UPDATE active_weighings 
       SET current_state = 'COMPLETED', 
           completion_time = NOW(),
           ticket_number = ?,
           updated_at = NOW()
       WHERE id_weighing = ?`,
      [ticketNumber, weighingId]
    );
    
    // Mettre à jour le statut de la planification
    if (weighing.id_planning) {
      await operationalPool.query(
        `UPDATE daily_planning SET status = 'COMPLETED' WHERE id_planning = ?`,
        [weighing.id_planning]
      );
    }
    
    // Décrémenter le quota client
    if (weighing.net && weighing.net > 0) {
      await operationalPool.query(
        `UPDATE client_quotas 
         SET consumed_quota = consumed_quota + ?,
             updated_at = NOW()
         WHERE client_name = ?`,
        [weighing.net, weighing.client_name]
      );
      
      // Vérifier si le quota est dépassé
      const [quotaRows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ? LIMIT 1`,
        [weighing.client_name]
      );
      
      if (quotaRows.length > 0) {
        const quota = quotaRows[0];
        if (quota.consumed_quota > quota.total_quota && !quota.is_blocked) {
          await operationalPool.query(
            `UPDATE client_quotas 
             SET is_blocked = TRUE, blocked_at = NOW() 
             WHERE client_name = ?`,
            [weighing.client_name]
          );
          console.log(`⚠️  Client ${weighing.client_name} bloqué - Quota dépassé`);
        }
      }
    }
    
    console.log(`✅ Pesage ${weighingId} finalisé - Ticket: ${ticketNumber}`);
    
    // Transférer vers la base historique (asynchrone, ne bloque pas la réponse)
    // Le service de transfert automatique s'en chargera aussi, mais on essaie immédiatement
    const historicalTransferService = require('../services/historicalTransferService');
    historicalTransferService.transferCompletedWeighing(weighingId)
      .then(result => {
        if (result.success) {
          if (result.existing) {
            console.log(`✅ [${weighingId}] Déjà présent dans l'historique`);
          } else {
            console.log(`✅ [${weighingId}] Transfert historique réussi (ID: ${result.historicalId})`);
          }
        } else {
          console.warn(`⚠️  [${weighingId}] Échec transfert historique: ${result.message}`);
          console.warn(`   Le service de transfert automatique réessayera dans quelques secondes`);
        }
      })
      .catch(error => {
        console.error(`❌ [${weighingId}] Erreur transfert historique:`, error.message);
        console.warn(`   Le service de transfert automatique réessayera dans quelques secondes`);
      });
    
    // Émettre événement WebSocket
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.weighingCompleted({
      weighing_id: weighingId,
      matricule: weighing.matricule,
      ticket_number: ticketNumber,
      net_weight: weighing.net,
      client_name: weighing.client_name
    });
    
    res.json({
      success: true,
      message: 'Pesage finalisé',
      weighing_id: weighingId,
      new_state: 'COMPLETED',
      ticket_number: ticketNumber,
      net_weight: weighing.net
    });
    
  } catch (error) {
    console.error(`❌ Erreur lors de la finalisation du pesage ${weighingId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * Fonction helper : Calcule tare, brut, net
 */
async function calculateWeights(weighingId, entryWeight, exitWeight, operationType) {
  let tare, brut, net;
  
  if (operationType === 'LOADING') {
    // Chargement : entry = TARE, exit = BRUT
    tare = entryWeight;
    brut = exitWeight;
    net = exitWeight - entryWeight;
  } else {
    // Déchargement : entry = BRUT, exit = TARE
    brut = entryWeight;
    tare = exitWeight;
    net = entryWeight - exitWeight;
  }
  
  await operationalPool.query(
    `UPDATE active_weighings 
     SET tare = ?, brut = ?, net = ?, updated_at = NOW()
     WHERE id_weighing = ?`,
    [tare, brut, net, weighingId]
  );
  
  console.log(`✅ Poids calculés pour pesage ${weighingId}: TARE=${tare}t, BRUT=${brut}t, NET=${net}t`);
}

/**
 * GET /api/weighings/active
 * Récupère tous les pesages actifs
 */
router.get('/active', async (req, res) => {
  try {
    const { pool: historicalPool } = require('../config/database');
    
    const [weighings] = await operationalPool.query(
      `SELECT 
        aw.*,
        dp.driver_name,
        dp.planned_quantity
       FROM active_weighings aw
       LEFT JOIN daily_planning dp ON aw.id_planning = dp.id_planning
       WHERE aw.current_state != 'COMPLETED' AND aw.current_state != 'CANCELLED'
       ORDER BY aw.arrival_time DESC`
    );
    
    // Récupérer les noms des produits depuis la base historique
    for (let weighing of weighings) {
      if (weighing.id_produit) {
        try {
          const [products] = await historicalPool.query(
            'SELECT nom_produit FROM produits WHERE id_produit = ? LIMIT 1',
            [weighing.id_produit]
          );
          if (products.length > 0) {
            weighing.nom_produit = products[0].nom_produit;
          }
        } catch (err) {
          console.warn(`⚠️  Impossible de récupérer le produit ${weighing.id_produit}:`, err.message);
        }
      }
    }
    
    res.json({
      success: true,
      count: weighings.length,
      data: weighings
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des pesages actifs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;
