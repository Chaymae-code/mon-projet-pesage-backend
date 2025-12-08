// ============================================
// CONTRÔLEUR : PRODUIT
// ============================================
// Gère toutes les opérations sur les produits

const { pool } = require('../config/database');
const Produit = require('../models/Produit');

/**
 * Récupère tous les produits avec leurs catégories
 * GET /api/produits
 */
const getAllProduits = async (req, res) => {
  console.log('📥 Demande: GET /api/produits');
  
  try {
    // Jointure avec la table categories pour avoir le nom de la catégorie
    const query = `
      SELECT p.*, c.nom_categorie 
      FROM produits p
      LEFT JOIN categories c ON p.id_categorie = c.id_categorie
      ORDER BY p.nom_produit
    `;
    
    const [rows] = await pool.query(query);
    
    const produits = rows.map(row => {
      const produit = Produit.fromDatabase(row);
      // Ajoute le nom de la catégorie à l'objet
      const produitJSON = produit.toJSON();
      produitJSON.nom_categorie = row.nom_categorie;
      return produitJSON;
    });
    
    res.json({
      success: true,
      count: produits.length,
      data: produits
    });
    
    console.log(`✅ Réponse: ${produits.length} produits trouvés`);
    
  } catch (error) {
    console.error('❌ Erreur getAllProduits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des produits',
      error: error.message
    });
  }
};

/**
 * Récupère un produit par son ID avec sa catégorie
 * GET /api/produits/:id
 */
const getProduitById = async (req, res) => {
  const produitId = req.params.id;
  console.log(`📥 Demande: GET /api/produits/${produitId}`);
  
  try {
    const query = `
      SELECT p.*, c.nom_categorie 
      FROM produits p
      LEFT JOIN categories c ON p.id_categorie = c.id_categorie
      WHERE p.id_produit = ?
    `;
    
    const [rows] = await pool.query(query, [produitId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Produit avec ID ${produitId} non trouvé`
      });
    }
    
    const produit = Produit.fromDatabase(rows[0]);
    const produitJSON = produit.toJSON();
    produitJSON.nom_categorie = rows[0].nom_categorie;
    
    res.json({
      success: true,
      data: produitJSON
    });
    
    console.log(`✅ Produit ${produitId} trouvé`);
    
  } catch (error) {
    console.error(`❌ Erreur getProduitById ${produitId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * Crée un nouveau produit
 * POST /api/produits
 */
const createProduit = async (req, res) => {
  console.log('📥 Demande: POST /api/produits');
  console.log('📦 Données reçues:', req.body);
  
  try {
    const { nom_produit, id_categorie, nombre_camions, tonnage } = req.body;
    
    // Validation
    if (!nom_produit || nom_produit.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom du produit est requis'
      });
    }
    
    if (!id_categorie) {
      return res.status(400).json({
        success: false,
        message: 'La catégorie est requise'
      });
    }
    
    // Vérifie que la catégorie existe
    const [categorieRows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?',
      [id_categorie]
    );
    
    if (categorieRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `La catégorie avec ID ${id_categorie} n'existe pas`
      });
    }
    
    // 1. Insère dans la base
    const [result] = await pool.query(
      'INSERT INTO produits (nom_produit, id_categorie, nombre_camions, tonnage) VALUES (?, ?, ?, ?)',
      [
        nom_produit.trim(),
        id_categorie,
        nombre_camions || 0,
        tonnage || 0.0
      ]
    );
    
    // 2. Récupère le produit créé avec le nom de la catégorie
    const query = `
      SELECT p.*, c.nom_categorie 
      FROM produits p
      LEFT JOIN categories c ON p.id_categorie = c.id_categorie
      WHERE p.id_produit = ?
    `;
    
    const [newRows] = await pool.query(query, [result.insertId]);
    
    const newProduit = Produit.fromDatabase(newRows[0]);
    const produitJSON = newProduit.toJSON();
    produitJSON.nom_categorie = newRows[0].nom_categorie;
    
    // 3. Renvoie la réponse
    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: produitJSON
    });
    
    console.log(`✅ Produit créé avec ID: ${result.insertId}`);
    
  } catch (error) {
    console.error('❌ Erreur createProduit:', error);
    
    // Si erreur de duplication (nom déjà existant)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Un produit avec ce nom existe déjà'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création',
      error: error.message
    });
  }
};

/**
 * Met à jour un produit existant
 * PUT /api/produits/:id
 */
const updateProduit = async (req, res) => {
  const produitId = req.params.id;
  console.log(`📥 Demande: PUT /api/produits/${produitId}`);
  console.log('📦 Données reçues:', req.body);
  
  try {
    const { nom_produit, id_categorie, nombre_camions, tonnage } = req.body;
    
    // Vérifie si le produit existe
    const [existingRows] = await pool.query(
      'SELECT * FROM produits WHERE id_produit = ?',
      [produitId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Produit avec ID ${produitId} non trouvé`
      });
    }
    
    // Validation
    if (nom_produit && nom_produit.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom du produit ne peut pas être vide'
      });
    }
    
    // Si on veut changer la catégorie, vérifie qu'elle existe
    if (id_categorie) {
      const [categorieRows] = await pool.query(
        'SELECT * FROM categories WHERE id_categorie = ?',
        [id_categorie]
      );
      
      if (categorieRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `La catégorie avec ID ${id_categorie} n'existe pas`
        });
      }
    }
    
    // Prépare les valeurs à mettre à jour
    const updates = {};
    if (nom_produit !== undefined) updates.nom_produit = nom_produit.trim();
    if (id_categorie !== undefined) updates.id_categorie = id_categorie;
    if (nombre_camions !== undefined) updates.nombre_camions = nombre_camions;
    if (tonnage !== undefined) updates.tonnage = tonnage;
    
    // Construit la requête dynamiquement
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.values(updates);
    values.push(produitId);
    
    // Met à jour dans la base
    await pool.query(
      `UPDATE produits SET ${setClause} WHERE id_produit = ?`,
      values
    );
    
    // Récupère le produit mis à jour avec le nom de la catégorie
    const query = `
      SELECT p.*, c.nom_categorie 
      FROM produits p
      LEFT JOIN categories c ON p.id_categorie = c.id_categorie
      WHERE p.id_produit = ?
    `;
    
    const [updatedRows] = await pool.query(query, [produitId]);
    
    const updatedProduit = Produit.fromDatabase(updatedRows[0]);
    const produitJSON = updatedProduit.toJSON();
    produitJSON.nom_categorie = updatedRows[0].nom_categorie;
    
    res.json({
      success: true,
      message: 'Produit mis à jour avec succès',
      data: produitJSON
    });
    
    console.log(`✅ Produit ${produitId} mis à jour`);
    
  } catch (error) {
    console.error(`❌ Erreur updateProduit ${produitId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour',
      error: error.message
    });
  }
};

/**
 * Supprime un produit
 * DELETE /api/produits/:id
 */
const deleteProduit = async (req, res) => {
  const produitId = req.params.id;
  console.log(`📥 Demande: DELETE /api/produits/${produitId}`);
  
  try {
    // Vérifie si le produit existe
    const [existingRows] = await pool.query(
      'SELECT * FROM produits WHERE id_produit = ?',
      [produitId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Produit avec ID ${produitId} non trouvé`
      });
    }
    
    // Vérifie si des pesages utilisent ce produit
    const [pesagesUsing] = await pool.query(
      'SELECT COUNT(*) as count FROM pesages WHERE id_produit = ?',
      [produitId]
    );
    
    if (pesagesUsing[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce produit car il est utilisé dans des pesages'
      });
    }
    
    // Supprime le produit
    await pool.query(
      'DELETE FROM produits WHERE id_produit = ?',
      [produitId]
    );
    
    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
    
    console.log(`✅ Produit ${produitId} supprimé`);
    
  } catch (error) {
    console.error(`❌ Erreur deleteProduit ${produitId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression',
      error: error.message
    });
  }
};

// Exporte toutes les fonctions
module.exports = {
  getAllProduits,
  getProduitById,
  createProduit,
  updateProduit,
  deleteProduit
};