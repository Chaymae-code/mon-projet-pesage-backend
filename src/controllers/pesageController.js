// ============================================
// CONTRÔLEUR : PESAGE
// ============================================
// Gère toutes les opérations sur les pesages

const { pool } = require('../config/database');
const Pesage = require('../models/Pesage');

/**
 * Récupère tous les pesages avec infos détaillées
 * GET /api/pesages
 */
const getAllPesages = async (req, res) => {
  console.log('📥 Demande: GET /api/pesages');
  
  try {
    // Jointure avec produits et catégories
    const query = `
      SELECT 
        ps.*,
        pr.nom_produit,
        pr.nombre_camions,
        pr.tonnage,
        c.nom_categorie
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      LEFT JOIN categories c ON pr.id_categorie = c.id_categorie
      ORDER BY ps.date_pesage DESC, ps.heure DESC
    `;
    
    const [rows] = await pool.query(query);
    
    const pesages = rows.map(row => {
      const pesage = Pesage.fromDatabase(row);
      const pesageJSON = pesage.toJSON();
      
      // Ajoute les informations supplémentaires
      pesageJSON.nom_produit = row.nom_produit;
      pesageJSON.nom_categorie = row.nom_categorie;
      pesageJSON.nombre_camions = row.nombre_camions;
      pesageJSON.tonnage = row.tonnage;
      
      // Ajoute les nouvelles colonnes de simulation (si présentes)
      if (row.type_pesage !== undefined) pesageJSON.type_pesage = row.type_pesage;
      if (row.premier_pesage !== undefined) pesageJSON.premier_pesage = row.premier_pesage;
      if (row.deuxieme_pesage !== undefined) pesageJSON.deuxieme_pesage = row.deuxieme_pesage;
      if (row.statut !== undefined) pesageJSON.statut = row.statut;
      if (row.heure_premier_pesage !== undefined) pesageJSON.heure_premier_pesage = row.heure_premier_pesage;
      if (row.heure_deuxieme_pesage !== undefined) pesageJSON.heure_deuxieme_pesage = row.heure_deuxieme_pesage;
      if (row.delai_zone !== undefined) pesageJSON.delai_zone = row.delai_zone;
      if (row.client !== undefined) pesageJSON.client = row.client;
      if (row.direction !== undefined) pesageJSON.direction = row.direction;
      
      return pesageJSON;
    });
    
    res.json({
      success: true,
      count: pesages.length,
      data: pesages
    });
    
    console.log(`✅ Réponse: ${pesages.length} pesages trouvés`);
    
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
  console.log(`📥 Demande: GET /api/pesages/${pesageId}`);
  
  try {
    const query = `
      SELECT 
        ps.*,
        pr.nom_produit,
        pr.nombre_camions,
        pr.tonnage,
        c.nom_categorie
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      LEFT JOIN categories c ON pr.id_categorie = c.id_categorie
      WHERE ps.id_pesage = ?
    `;
    
    const [rows] = await pool.query(query, [pesageId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Pesage avec ID ${pesageId} non trouvé`
      });
    }
    
    const pesage = Pesage.fromDatabase(rows[0]);
    const pesageJSON = pesage.toJSON();
    
    pesageJSON.nom_produit = rows[0].nom_produit;
    pesageJSON.nom_categorie = rows[0].nom_categorie;
    pesageJSON.nombre_camions = rows[0].nombre_camions;
    pesageJSON.tonnage = rows[0].tonnage;
    
    res.json({
      success: true,
      data: pesageJSON
    });
    
    console.log(`✅ Pesage ${pesageId} trouvé`);
    
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
 */
const createPesage = async (req, res) => {
  console.log('📥 Demande: POST /api/pesages');
  console.log('📦 Données reçues:', req.body);
  
  try {
    const { 
      id_produit, 
      date_pesage, 
      camion, 
      heure, 
      ticket, 
      tare, 
      brut, 
      net 
    } = req.body;
    
    // Validation de base
    if (!id_produit) {
      return res.status(400).json({
        success: false,
        message: 'Le produit est requis'
      });
    }
    
    if (!camion || camion.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le numéro de camion est requis'
      });
    }
    
    // Vérifie que le produit existe
    const [produitRows] = await pool.query(
      'SELECT * FROM produits WHERE id_produit = ?',
      [id_produit]
    );
    
    if (produitRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Le produit avec ID ${id_produit} n'existe pas`
      });
    }
    
    // Calcule le net si non fourni
    let poidsNet = net;
    if (poidsNet === undefined && tare !== undefined && brut !== undefined) {
      const pesageTemp = new Pesage(null, id_produit, date_pesage, camion, heure, ticket, tare, brut);
      poidsNet = pesageTemp.calculateNet();
    }
    
    // 1. Insère dans la base
    const [result] = await pool.query(
      `INSERT INTO pesages 
       (id_produit, date_pesage, camion, heure, ticket, tare, brut, net) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_produit,
        date_pesage || new Date().toISOString().split('T')[0],
        camion.trim(),
        heure || new Date().toTimeString().split(' ')[0].slice(0, 8),
        ticket || '',
        tare || 0.0,
        brut || 0.0,
        poidsNet || 0.0
      ]
    );
    
    // 2. Récupère le pesage créé avec les infos du produit
    const query = `
      SELECT 
        ps.*,
        pr.nom_produit,
        pr.nombre_camions,
        pr.tonnage,
        c.nom_categorie
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      LEFT JOIN categories c ON pr.id_categorie = c.id_categorie
      WHERE ps.id_pesage = ?
    `;
    
    const [newRows] = await pool.query(query, [result.insertId]);
    
    const newPesage = Pesage.fromDatabase(newRows[0]);
    const pesageJSON = newPesage.toJSON();
    
    pesageJSON.nom_produit = newRows[0].nom_produit;
    pesageJSON.nom_categorie = newRows[0].nom_categorie;
    pesageJSON.nombre_camions = newRows[0].nombre_camions;
    pesageJSON.tonnage = newRows[0].tonnage;
    
    // 3. Renvoie la réponse
    res.status(201).json({
      success: true,
      message: 'Pesage créé avec succès',
      data: pesageJSON
    });
    
    console.log(`✅ Pesage créé avec ID: ${result.insertId}`);
    
  } catch (error) {
    console.error('❌ Erreur createPesage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création',
      error: error.message
    });
  }
};

/**
 * Met à jour un pesage existant
 * PUT /api/pesages/:id
 */
const updatePesage = async (req, res) => {
  const pesageId = req.params.id;
  console.log(`📥 Demande: PUT /api/pesages/${pesageId}`);
  console.log('📦 Données reçues:', req.body);
  
  try {
    // Vérifie si le pesage existe
    const [existingRows] = await pool.query(
      'SELECT * FROM pesages WHERE id_pesage = ?',
      [pesageId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Pesage avec ID ${pesageId} non trouvé`
      });
    }
    
    const updates = req.body;
    
    // Si on veut changer le produit, vérifie qu'il existe
    if (updates.id_produit) {
      const [produitRows] = await pool.query(
        'SELECT * FROM produits WHERE id_produit = ?',
        [updates.id_produit]
      );
      
      if (produitRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Le produit avec ID ${updates.id_produit} n'existe pas`
        });
      }
    }
    
    // Recalcule le net si tare ou brut sont modifiés
    if (updates.tare !== undefined || updates.brut !== undefined) {
      const existing = existingRows[0];
      const newTare = updates.tare !== undefined ? updates.tare : existing.tare;
      const newBrut = updates.brut !== undefined ? updates.brut : existing.brut;
      
      const pesageTemp = new Pesage(null, null, null, null, null, null, newTare, newBrut);
      updates.net = pesageTemp.calculateNet();
    }
    
    // Construit la requête dynamiquement
    const fields = Object.keys(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(pesageId);
    
    // Met à jour dans la base
    await pool.query(
      `UPDATE pesages SET ${setClause} WHERE id_pesage = ?`,
      values
    );
    
    // Récupère le pesage mis à jour
    const query = `
      SELECT 
        ps.*,
        pr.nom_produit,
        pr.nombre_camions,
        pr.tonnage,
        c.nom_categorie
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      LEFT JOIN categories c ON pr.id_categorie = c.id_categorie
      WHERE ps.id_pesage = ?
    `;
    
    const [updatedRows] = await pool.query(query, [pesageId]);
    
    const updatedPesage = Pesage.fromDatabase(updatedRows[0]);
    const pesageJSON = updatedPesage.toJSON();
    
    pesageJSON.nom_produit = updatedRows[0].nom_produit;
    pesageJSON.nom_categorie = updatedRows[0].nom_categorie;
    pesageJSON.nombre_camions = updatedRows[0].nombre_camions;
    pesageJSON.tonnage = updatedRows[0].tonnage;
    
    res.json({
      success: true,
      message: 'Pesage mis à jour avec succès',
      data: pesageJSON
    });
    
    console.log(`✅ Pesage ${pesageId} mis à jour`);
    
  } catch (error) {
    console.error(`❌ Erreur updatePesage ${pesageId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour',
      error: error.message
    });
  }
};

/**
 * Supprime un pesage
 * DELETE /api/pesages/:id
 */
const deletePesage = async (req, res) => {
  const pesageId = req.params.id;
  console.log(`📥 Demande: DELETE /api/pesages/${pesageId}`);
  
  try {
    // Vérifie si le pesage existe
    const [existingRows] = await pool.query(
      'SELECT * FROM pesages WHERE id_pesage = ?',
      [pesageId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Pesage avec ID ${pesageId} non trouvé`
      });
    }
    
    // Supprime le pesage
    await pool.query(
      'DELETE FROM pesages WHERE id_pesage = ?',
      [pesageId]
    );
    
    res.json({
      success: true,
      message: 'Pesage supprimé avec succès'
    });
    
    console.log(`✅ Pesage ${pesageId} supprimé`);
    
  } catch (error) {
    console.error(`❌ Erreur deletePesage ${pesageId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression',
      error: error.message
    });
  }
};

/**
 * Statistiques des pesages
 * GET /api/pesages/stats
 */
const getStats = async (req, res) => {
  console.log('📥 Demande: GET /api/pesages/stats');
  
  try {
    // Statistiques générales
    const [generalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_pesages,
        SUM(net) as total_net,
        AVG(net) as moyenne_net,
        MIN(date_pesage) as date_debut,
        MAX(date_pesage) as date_fin,
        COUNT(DISTINCT camion) as camions_distincts,
        COUNT(DISTINCT id_produit) as produits_distincts
      FROM pesages
      WHERE net > 0
    `);
    
    // Statistiques par jour (7 derniers jours)
    const [dailyStats] = await pool.query(`
      SELECT 
        date_pesage,
        COUNT(*) as nb_pesages,
        SUM(net) as total_net_jour
      FROM pesages
      WHERE date_pesage IS NOT NULL
      GROUP BY date_pesage
      ORDER BY date_pesage DESC
      LIMIT 7
    `);
    
    // Statistiques par produit
    const [produitsStats] = await pool.query(`
      SELECT 
        pr.nom_produit,
        pr.id_produit,
        COUNT(*) as nb_pesages,
        SUM(ps.net) as total_net
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      WHERE ps.net > 0
      GROUP BY pr.id_produit, pr.nom_produit
      ORDER BY total_net DESC
    `);
    
    // Top 5 camions
    const [camionsStats] = await pool.query(`
      SELECT 
        camion,
        COUNT(*) as nb_pesages,
        SUM(net) as total_net
      FROM pesages
      WHERE camion IS NOT NULL AND camion != ''
      GROUP BY camion
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
    
    console.log('✅ Statistiques générées');
    
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