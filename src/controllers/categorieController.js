// ============================================
// CONTRÔLEUR : CATÉGORIE
// ============================================
// Gère toutes les opérations sur les catégories

const { pool } = require('../config/database');
const Categorie = require('../models/Categorie');

/**
 * Récupère toutes les catégories
 * GET /api/categories
 */
const getAllCategories = async (req, res) => {
  console.log('📥 Demande: GET /api/categories');
  
  try {
    // 1. Exécute la requête SQL
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY nom_categorie');
    
    // 2. Convertit chaque ligne en objet Categorie
    const categories = rows.map(row => Categorie.fromDatabase(row));
    
    // 3. Renvoie la réponse
    res.json({
      success: true,
      count: categories.length,
      data: categories.map(cat => cat.toJSON())
    });
    
    console.log(`✅ Réponse: ${categories.length} catégories trouvées`);
    
  } catch (error) {
    console.error('❌ Erreur getAllCategories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des catégories',
      error: error.message
    });
  }
};

/**
 * Récupère une catégorie par son ID
 * GET /api/categories/:id
 */
const getCategorieById = async (req, res) => {
  const categorieId = req.params.id;
  console.log(`📥 Demande: GET /api/categories/${categorieId}`);
  
  try {
    const [rows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?', 
      [categorieId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Catégorie avec ID ${categorieId} non trouvée`
      });
    }
    
    const categorie = Categorie.fromDatabase(rows[0]);
    
    res.json({
      success: true,
      data: categorie.toJSON()
    });
    
    console.log(`✅ Catégorie ${categorieId} trouvée`);
    
  } catch (error) {
    console.error(`❌ Erreur getCategorieById ${categorieId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * Crée une nouvelle catégorie
 * POST /api/categories
 */
const createCategorie = async (req, res) => {
  console.log('📥 Demande: POST /api/categories');
  console.log('📦 Données reçues:', req.body);
  
  try {
    const { nom_categorie } = req.body;
    
    // Validation
    if (!nom_categorie || nom_categorie.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la catégorie est requis'
      });
    }
    
    // 1. Insère dans la base
    const [result] = await pool.query(
      'INSERT INTO categories (nom_categorie) VALUES (?)',
      [nom_categorie.trim()]
    );
    
    // 2. Récupère la catégorie créée
    const [newRows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?',
      [result.insertId]
    );
    
    const newCategorie = Categorie.fromDatabase(newRows[0]);
    
    // 3. Renvoie la réponse
    res.status(201).json({
      success: true,
      message: 'Catégorie créée avec succès',
      data: newCategorie.toJSON()
    });
    
    console.log(`✅ Catégorie créée avec ID: ${result.insertId}`);
    
  } catch (error) {
    console.error('❌ Erreur createCategorie:', error);
    
    // Si erreur de duplication (nom déjà existant)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Une catégorie avec ce nom existe déjà'
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
 * Met à jour une catégorie existante
 * PUT /api/categories/:id
 */
const updateCategorie = async (req, res) => {
  const categorieId = req.params.id;
  console.log(`📥 Demande: PUT /api/categories/${categorieId}`);
  console.log('📦 Données reçues:', req.body);
  
  try {
    const { nom_categorie } = req.body;
    
    // Vérifie si la catégorie existe
    const [existingRows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?',
      [categorieId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Catégorie avec ID ${categorieId} non trouvée`
      });
    }
    
    // Validation
    if (!nom_categorie || nom_categorie.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la catégorie est requis'
      });
    }
    
    // Met à jour dans la base
    await pool.query(
      'UPDATE categories SET nom_categorie = ? WHERE id_categorie = ?',
      [nom_categorie.trim(), categorieId]
    );
    
    // Récupère la catégorie mise à jour
    const [updatedRows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?',
      [categorieId]
    );
    
    const updatedCategorie = Categorie.fromDatabase(updatedRows[0]);
    
    res.json({
      success: true,
      message: 'Catégorie mise à jour avec succès',
      data: updatedCategorie.toJSON()
    });
    
    console.log(`✅ Catégorie ${categorieId} mise à jour`);
    
  } catch (error) {
    console.error(`❌ Erreur updateCategorie ${categorieId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour',
      error: error.message
    });
  }
};

/**
 * Supprime une catégorie
 * DELETE /api/categories/:id
 */
const deleteCategorie = async (req, res) => {
  const categorieId = req.params.id;
  console.log(`📥 Demande: DELETE /api/categories/${categorieId}`);
  
  try {
    // Vérifie si la catégorie existe
    const [existingRows] = await pool.query(
      'SELECT * FROM categories WHERE id_categorie = ?',
      [categorieId]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Catégorie avec ID ${categorieId} non trouvée`
      });
    }
    
    // Vérifie si des produits utilisent cette catégorie
    const [productsUsing] = await pool.query(
      'SELECT COUNT(*) as count FROM produits WHERE id_categorie = ?',
      [categorieId]
    );
    
    if (productsUsing[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cette catégorie car elle est utilisée par des produits'
      });
    }
    
    // Supprime la catégorie
    await pool.query(
      'DELETE FROM categories WHERE id_categorie = ?',
      [categorieId]
    );
    
    res.json({
      success: true,
      message: 'Catégorie supprimée avec succès'
    });
    
    console.log(`✅ Catégorie ${categorieId} supprimée`);
    
  } catch (error) {
    console.error(`❌ Erreur deleteCategorie ${categorieId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression',
      error: error.message
    });
  }
};

// Exporte toutes les fonctions
module.exports = {
  getAllCategories,
  getCategorieById,
  createCategorie,
  updateCategorie,
  deleteCategorie
};