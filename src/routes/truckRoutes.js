// ============================================
// ROUTES : DÉTECTION DE CAMIONS (OpenCV)
// ============================================
// Gère la détection de plaques d'immatriculation depuis OpenCV
// et l'autorisation basée sur la planification quotidienne

const express = require('express');
const router = express.Router();
const { operationalPool } = require('../config/operationalDatabase');
const { pool: historicalPool } = require('../config/database');

/**
 * POST /api/trucks/detect
 * Reçoit un matricule détecté par OpenCV
 * Vérifie la planification et autorise ou rejette le camion
 */
router.post('/detect', async (req, res) => {
  const { matricule } = req.body;
  
  console.log(`🔍 Détection camion - Matricule: ${matricule}`);
  
  if (!matricule) {
    return res.status(400).json({
      success: false,
      authorized: false,
      message: 'Matricule requis'
    });
  }
  
  try {
    // 1. Vérifier dans daily_planning (base opérationnelle)
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`📋 Recherche planification pour ${matricule} le ${today}`);
    
    const [planningRows] = await operationalPool.query(
      `SELECT * FROM daily_planning 
       WHERE matricule = ? AND date_planning = ? AND status = 'PENDING'
       LIMIT 1`,
      [matricule, today]
    );
    
    if (planningRows.length === 0) {
      console.log(`❌ Camion ${matricule} non trouvé dans la planification`);
      
      return res.json({
        success: false,
        authorized: false,
        message: 'Camion non autorisé - Non planifié pour aujourd\'hui',
        matricule: matricule,
        reason: 'NOT_PLANNED'
      });
    }
    
    const planning = planningRows[0];
    console.log(`✅ Planification trouvée pour ${matricule}:`, {
      client: planning.client_name,
      produit: planning.id_produit,
      operation: planning.operation_type,
      driver: planning.driver_name
    });
    console.log(`📋 Données complètes de la planification:`, JSON.stringify(planning, null, 2));
    
    // 2. Vérifier quota client
    const [quotaRows] = await operationalPool.query(
      `SELECT * FROM client_quotas WHERE client_name = ? LIMIT 1`,
      [planning.client_name]
    );
    
    if (quotaRows.length > 0) {
      const quota = quotaRows[0];
      
      if (quota.is_blocked) {
        console.log(`❌ Client ${planning.client_name} bloqué - Quota dépassé`);
        
        return res.json({
          success: false,
          authorized: false,
          message: `Client bloqué - Quota dépassé (${quota.consumed_quota}/${quota.total_quota}t)`,
          matricule: matricule,
          reason: 'QUOTA_EXCEEDED',
          client: planning.client_name
        });
      }
      
      console.log(`✅ Quota client OK: ${quota.remaining_quota}t restantes`);
    }
    
    // 3. Vérifier si un pesage actif existe déjà pour ce matricule
    const [existingWeighings] = await operationalPool.query(
      `SELECT * FROM active_weighings 
       WHERE matricule = ? AND current_state != 'COMPLETED' AND current_state != 'CANCELLED'
       LIMIT 1`,
      [matricule]
    );
    
    if (existingWeighings.length > 0) {
      console.log(`⚠️  Pesage actif déjà existant pour ${matricule}`);
      
      const existingWeighing = existingWeighings[0];
      
      // Récupérer le nom du produit depuis la base historique
      let productName = 'N/A';
      try {
        const [productRows] = await historicalPool.query(
          'SELECT nom_produit FROM produits WHERE id_produit = ? LIMIT 1',
          [existingWeighing.id_produit]
        );
        if (productRows.length > 0) {
          productName = productRows[0].nom_produit;
          console.log(`✅ Nom du produit récupéré: ${productName}`);
        } else {
          console.warn(`⚠️  Produit avec ID ${existingWeighing.id_produit} non trouvé dans la base historique`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération du produit: ${error.message}`);
        console.error(`   Détails:`, error);
      }
      
      // Préparer la réponse avec toutes les informations
      const response = {
        success: true,
        authorized: true,
        message: 'Camion déjà en cours de traitement',
        matricule: matricule,
        weighing_id: existingWeighing.id_weighing,
        existing: true,
        planning: {
          client_name: existingWeighing.client_name,
          product_id: existingWeighing.id_produit,
          product_name: productName,
          operation: existingWeighing.operation_type
        },
        state: existingWeighing.current_state
      };
      
      console.log(`📤 Réponse envoyée (pesage existant):`, JSON.stringify(response, null, 2));
      
      // Émettre événement WebSocket même pour un pesage existant
      const { WeighingEvents } = require('../websocket/websocketServer');
      WeighingEvents.truckArrived({
        weighing_id: existingWeighing.id_weighing,
        matricule: matricule,
        client_name: existingWeighing.client_name,
        product_name: productName,
        state: existingWeighing.current_state
      });
      
      return res.json(response);
    }
    
    // 4. Créer active_weighing
    const [weighingResult] = await operationalPool.query(
      `INSERT INTO active_weighings 
       (id_planning, matricule, client_name, id_produit, operation_type, current_state, arrival_time)
       VALUES (?, ?, ?, ?, ?, 'ARRIVAL', NOW())`,
      [
        planning.id_planning,
        matricule,
        planning.client_name,
        planning.id_produit,
        planning.operation_type
      ]
    );
    
    const weighingId = weighingResult.insertId;
    console.log(`✅ Pesage actif créé: ID ${weighingId}`);
    
    // 5. Mettre à jour planning status
    await operationalPool.query(
      `UPDATE daily_planning SET status = 'IN_PROGRESS' WHERE id_planning = ?`,
      [planning.id_planning]
    );
    
    // 6. Récupérer le nom du produit depuis la base historique
    let productName = 'N/A';
    try {
      const [productRows] = await historicalPool.query(
        'SELECT nom_produit FROM produits WHERE id_produit = ? LIMIT 1',
        [planning.id_produit]
      );
      if (productRows.length > 0) {
        productName = productRows[0].nom_produit;
        console.log(`✅ Nom du produit récupéré: ${productName}`);
      } else {
        console.warn(`⚠️  Produit avec ID ${planning.id_produit} non trouvé dans la base historique`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération du produit: ${error.message}`);
      console.error(`   Détails:`, error);
    }
    
    // 7. Préparer la réponse avec toutes les informations
    const response = {
      success: true,
      authorized: true,
      message: 'Camion autorisé',
      matricule: matricule,
      weighing_id: weighingId,
      planning: {
        driver_name: planning.driver_name,
        client_name: planning.client_name,
        product_id: planning.id_produit,
        product_name: productName,
        operation: planning.operation_type,
        planned_quantity: planning.planned_quantity
      },
      state: 'ARRIVAL',
      arrival_time: new Date().toISOString()
    };
    
    console.log(`✅ Camion ${matricule} autorisé - Pesage ID: ${weighingId}`);
    console.log(`📤 Réponse envoyée:`, JSON.stringify(response, null, 2));
    
    // Émettre événement WebSocket
    const { WeighingEvents } = require('../websocket/websocketServer');
    WeighingEvents.truckArrived({
      weighing_id: weighingId,
      matricule: matricule,
      client_name: planning.client_name,
      product_name: productName,
      state: 'ARRIVAL'
    });
    
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Erreur lors de la détection du camion ${matricule}:`, error);
    res.status(500).json({
      success: false,
      authorized: false,
      message: 'Erreur serveur lors de la vérification',
      error: error.message
    });
  }
});

/**
 * GET /api/trucks/active
 * Récupère tous les camions actifs (en cours de pesage)
 */
router.get('/active', async (req, res) => {
  try {
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
    
    res.json({
      success: true,
      count: weighings.length,
      data: weighings
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des camions actifs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;
