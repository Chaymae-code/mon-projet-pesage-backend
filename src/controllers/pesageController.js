// ============================================
// CONTRÔLEUR : PESAGE
// ============================================
// Gère toutes les opérations sur les pesages historiques
// Utilise la base pesage_data (historique)

const { historicalPool } = require('../config/historicalDatabase');
const Pesage = require('../models/Pesage');

/**
 * Récupère tous les pesages avec infos détaillées
 * GET /api/pesages
 */
const getAllPesages = async (req, res) => {
  console.log('📥 Demande: GET /api/pesages (base historique)');
  
  try {
    // Jointure avec matricules, clients et produits depuis pesage_data
    const query = `
      SELECT 
        ps.id as id_pesage,
        DATE_FORMAT(ps.date, '%Y-%m-%d') as date_pesage,
        ps.heure,
        ps.ticket,
        ps.brut,
        ps.tare,
        ps.net,
        m.code_matricule as camion,
        c.nom_client,
        pr.nom_produit,
        pr.id as produit_id_historical,
        ps.created_at,
        ps.updated_at
      FROM pesages ps
      LEFT JOIN matricules m ON ps.matricule_id = m.id
      LEFT JOIN clients c ON ps.client_id = c.id
      LEFT JOIN produits pr ON ps.produit_id = pr.id
      ORDER BY ps.date DESC, ps.heure DESC
    `;
    
    const [rows] = await historicalPool.query(query);
    
    // Transformer les données pour correspondre au format attendu par le frontend
    const pesages = rows.map(row => {
      return {
        id_pesage: row.id_pesage,
        id_produit: row.produit_id_historical,
        date_pesage: row.date_pesage || null,
        camion: row.camion || 'N/A',
        heure: row.heure ? row.heure.substring(0, 8) : '00:00:00',
        ticket: row.ticket || '',
        tare: parseFloat(row.tare) || 0,
        brut: parseFloat(row.brut) || 0,
        net: parseFloat(row.net) || 0,
        nom_produit: row.nom_produit || 'N/A',
        nom_client: row.nom_client || 'N/A',
        nom_categorie: null, // Pas de catégorie dans pesage_data
        nombre_camions: null,
        tonnage: null
      };
    });
    
    res.json({
      success: true,
      count: pesages.length,
      data: pesages
    });
    
    console.log(`✅ Réponse: ${pesages.length} pesages trouvés dans l'historique`);
    
  } catch (error) {
    console.error('❌ Erreur getAllPesages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des pesages',
      error: error.message
    });
  }
};

/**
 * Récupère un pesage par son ID
 * GET /api/pesages/:id
 */
const getPesageById = async (req, res) => {
  const pesageId = req.params.id;
  console.log(`📥 Demande: GET /api/pesages/${pesageId} (base historique)`);
  
  try {
    const query = `
      SELECT 
        ps.id as id_pesage,
        DATE_FORMAT(ps.date, '%Y-%m-%d') as date_pesage,
        ps.heure,
        ps.ticket,
        ps.brut,
        ps.tare,
        ps.net,
        m.code_matricule as camion,
        c.nom_client,
        pr.nom_produit,
        pr.id as produit_id_historical,
        ps.created_at,
        ps.updated_at
      FROM pesages ps
      LEFT JOIN matricules m ON ps.matricule_id = m.id
      LEFT JOIN clients c ON ps.client_id = c.id
      LEFT JOIN produits pr ON ps.produit_id = pr.id
      WHERE ps.id = ?
    `;
    
    const [rows] = await historicalPool.query(query, [pesageId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Pesage avec ID ${pesageId} non trouvé`
      });
    }
    
    const row = rows[0];
    const pesageJSON = {
      id_pesage: row.id_pesage,
      id_produit: row.produit_id_historical,
      date_pesage: row.date_pesage || null,
      camion: row.camion || 'N/A',
      heure: row.heure ? row.heure.substring(0, 8) : '00:00:00',
      ticket: row.ticket || '',
      tare: parseFloat(row.tare) || 0,
      brut: parseFloat(row.brut) || 0,
      net: parseFloat(row.net) || 0,
      nom_produit: row.nom_produit || 'N/A',
      nom_client: row.nom_client || 'N/A',
      nom_categorie: null,
      nombre_camions: null,
      tonnage: null
    };
    
    res.json({
      success: true,
      data: pesageJSON
    });
    
    console.log(`✅ Pesage ${pesageId} trouvé dans l'historique`);
    
  } catch (error) {
    console.error(`❌ Erreur getPesageById ${pesageId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * Crée un nouveau pesage
 * POST /api/pesages
 * NOTE: Les pesages sont normalement créés automatiquement via le transfert historique
 * Cette fonction est conservée pour compatibilité mais devrait rarement être utilisée
 */
const createPesage = async (req, res) => {
  console.log('📥 Demande: POST /api/pesages (base historique)');
  console.log('⚠️  ATTENTION: Les pesages doivent être créés via le transfert automatique');
  console.log('📦 Données reçues:', req.body);
  
  return res.status(400).json({
    success: false,
    message: 'Les pesages historiques sont créés automatiquement lors de la finalisation. Utilisez le workflow de pesage opérationnel.'
  });
};

/**
 * Met à jour un pesage existant
 * PUT /api/pesages/:id
 * NOTE: Les pesages historiques sont normalement en lecture seule
 */
const updatePesage = async (req, res) => {
  const pesageId = req.params.id;
  console.log(`📥 Demande: PUT /api/pesages/${pesageId} (base historique)`);
  console.log('⚠️  ATTENTION: Les pesages historiques sont normalement en lecture seule');
  
  return res.status(400).json({
    success: false,
    message: 'Les pesages historiques sont en lecture seule. Modifiez les pesages dans le workflow opérationnel.'
  });
};

/**
 * Supprime un pesage
 * DELETE /api/pesages/:id
 * NOTE: Les pesages historiques sont normalement en lecture seule
 */
const deletePesage = async (req, res) => {
  const pesageId = req.params.id;
  console.log(`📥 Demande: DELETE /api/pesages/${pesageId} (base historique)`);
  console.log('⚠️  ATTENTION: Les pesages historiques sont normalement en lecture seule');
  
  return res.status(400).json({
    success: false,
    message: 'Les pesages historiques sont en lecture seule et ne peuvent pas être supprimés.'
  });
};

/**
 * Statistiques des pesages
 * GET /api/pesages/stats
 */
const getStats = async (req, res) => {
  console.log('📥 Demande: GET /api/pesages/stats (base historique)');
  
  try {
    // Statistiques générales
    const [generalStats] = await historicalPool.query(`
      SELECT 
        COUNT(*) as total_pesages,
        SUM(ps.net) as total_net,
        AVG(ps.net) as moyenne_net,
        MIN(ps.date) as date_debut,
        MAX(ps.date) as date_fin,
        COUNT(DISTINCT ps.matricule_id) as camions_distincts,
        COUNT(DISTINCT ps.produit_id) as produits_distincts
      FROM pesages ps
      WHERE ps.net > 0
    `);
    
    // Statistiques par jour (7 derniers jours)
    const [dailyStats] = await historicalPool.query(`
      SELECT 
        ps.date as date_pesage,
        COUNT(*) as nb_pesages,
        SUM(ps.net) as total_net_jour
      FROM pesages ps
      WHERE ps.date IS NOT NULL
      GROUP BY ps.date
      ORDER BY ps.date DESC
      LIMIT 7
    `);
    
    // Statistiques par produit
    const [produitsStats] = await historicalPool.query(`
      SELECT 
        pr.nom_produit,
        pr.id as id_produit,
        COUNT(*) as nb_pesages,
        SUM(ps.net) as total_net
      FROM pesages ps
      LEFT JOIN produits pr ON ps.produit_id = pr.id
      WHERE ps.net > 0
      GROUP BY pr.id, pr.nom_produit
      ORDER BY total_net DESC
    `);
    
    // Top 5 camions
    const [camionsStats] = await historicalPool.query(`
      SELECT 
        m.code_matricule as camion,
        COUNT(*) as nb_pesages,
        SUM(ps.net) as total_net
      FROM pesages ps
      LEFT JOIN matricules m ON ps.matricule_id = m.id
      WHERE m.code_matricule IS NOT NULL AND m.code_matricule != ''
      GROUP BY m.code_matricule
      ORDER BY total_net DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        general: generalStats[0],
        quotidien: dailyStats,
        par_produit: produitsStats,
        par_camion: camionsStats
      }
    });
    
    console.log('✅ Statistiques générées depuis l\'historique');
    
  } catch (error) {
    console.error('❌ Erreur getStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du calcul des statistiques',
      error: error.message
    });
  }
};

// Exporte toutes les fonctions
module.exports = {
  getAllPesages,
  getPesageById,
  createPesage,
  updatePesage,
  deletePesage,
  getStats
};