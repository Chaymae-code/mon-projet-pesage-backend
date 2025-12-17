// ============================================
// ROUTES : GESTION DE LA PLANIFICATION
// ============================================
// Gère l'import, la création, modification et suppression de la planification quotidienne

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { operationalPool } = require('../config/operationalDatabase');
const { pool: historicalPool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { generatePlanningTemplate } = require('../utils/generatePlanningTemplate');

// Configuration Multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'planning-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez Excel (.xlsx, .xls) ou CSV (.csv)'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

/**
 * GET /api/planning/template
 * Télécharge le modèle Excel pour la planification
 */
router.get('/template', authenticateToken, (req, res) => {
  try {
    console.log('📥 Demande de téléchargement du modèle Excel');
    
    // Générer le modèle
    let templatePath;
    try {
      templatePath = generatePlanningTemplate();
      console.log(`✅ Modèle généré: ${templatePath}`);
    } catch (genError) {
      console.error('❌ Erreur lors de la génération:', genError);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération du modèle',
        error: genError.message
      });
    }
    
    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Fichier modèle non trouvé: ${templatePath}`);
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé après génération',
        path: templatePath
      });
    }
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(templatePath);
    console.log(`📊 Taille du fichier: ${stats.size} bytes`);
    
    if (stats.size === 0) {
      console.error('❌ Le fichier est vide');
      return res.status(500).json({
        success: false,
        message: 'Le fichier modèle est vide'
      });
    }
    
    console.log(`📤 Envoi du fichier: ${templatePath}`);
    
    // Définir les headers avant sendFile
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modele_planification.xlsx"');
    
    // Utiliser sendFile avec le chemin absolu
    res.sendFile(path.resolve(templatePath), (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'envoi du fichier:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du fichier',
            error: err.message
          });
        }
      } else {
        console.log('✅ Fichier envoyé avec succès');
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération du modèle:', error);
    console.error('Stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
});

/**
 * POST /api/planning/import
 * Importe un fichier Excel/CSV de planification
 */
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Aucun fichier fourni'
    });
  }
  
  const filePath = req.file.path;
  const datePlanning = req.body.date || new Date().toISOString().split('T')[0];
  
  try {
    // Lire le fichier
    let workbook;
    if (filePath.endsWith('.csv')) {
      // Lire CSV
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      workbook = XLSX.read(fileContent, { type: 'string' });
    } else {
      // Lire Excel
      workbook = XLSX.readFile(filePath);
    }
    
    // Prendre la première feuille
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir en JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null 
    });
    
    if (data.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier est vide ou ne contient que l\'en-tête'
      });
    }
    
    // Récupérer l'en-tête (première ligne)
    const headers = data[0].map(h => h ? h.toString().trim().toLowerCase() : '');
    
    // Trouver les indices des colonnes
    const colIndices = {
      matricule: headers.findIndex(h => h.includes('matricule') || h.includes('plaque')),
      chauffeur: headers.findIndex(h => h.includes('chauffeur') || h.includes('conducteur')),
      client: headers.findIndex(h => h.includes('client')),
      produit: headers.findIndex(h => h.includes('produit')),
      type: headers.findIndex(h => h.includes('type') || h.includes('opération')),
      quantite: headers.findIndex(h => h.includes('quantité') || h.includes('quantite') || h.includes('qte')),
      heure: headers.findIndex(h => h.includes('heure') || h.includes('time')) // Optionnel
    };
    
    // Vérifier que les colonnes essentielles sont présentes
    if (colIndices.matricule === -1 || colIndices.client === -1 || colIndices.produit === -1) {
      return res.status(400).json({
        success: false,
        message: 'Colonnes manquantes. Format attendu: Matricule, Client, Produit (minimum)'
      });
    }
    
    // Récupérer tous les produits de la base historique
    const [products] = await historicalPool.query('SELECT id_produit, nom_produit FROM produits');
    const productsMap = {};
    products.forEach(p => {
      productsMap[p.nom_produit.toLowerCase().trim()] = p.id_produit;
    });
    
    const results = {
      success: 0,
      errors: [],
      warnings: []
    };
    
    // Traiter chaque ligne (sauf l'en-tête)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Ignorer les lignes vides
      if (!row[colIndices.matricule]) continue;
      
      try {
        const matricule = row[colIndices.matricule]?.toString().trim().toUpperCase();
        const chauffeur = colIndices.chauffeur >= 0 ? (row[colIndices.chauffeur]?.toString().trim() || null) : null;
        const client = row[colIndices.client]?.toString().trim();
        const produitNom = row[colIndices.produit]?.toString().trim();
        const typeStr = colIndices.type >= 0 ? (row[colIndices.type]?.toString().trim().toLowerCase() || 'chargement') : 'chargement';
        const quantite = colIndices.quantite >= 0 ? parseFloat(row[colIndices.quantite]?.toString().replace(',', '.')) || null : null;
        // Heure : utiliser l'heure actuelle si non fournie
        const heure = colIndices.heure >= 0 && row[colIndices.heure] 
          ? (row[colIndices.heure]?.toString().trim() || null) 
          : new Date().toTimeString().slice(0, 5); // Format HH:MM
        
        // Validation
        if (!matricule || !client || !produitNom) {
          results.errors.push(`Ligne ${i + 1}: Données manquantes (Matricule, Client ou Produit)`);
          continue;
        }
        
        // Trouver l'ID du produit
        const produitId = productsMap[produitNom.toLowerCase()];
        if (!produitId) {
          results.errors.push(`Ligne ${i + 1}: Produit "${produitNom}" non trouvé dans la base de données`);
          continue;
        }
        
        // Déterminer le type d'opération
        const operationType = typeStr.includes('déchargement') || typeStr.includes('dechargement') || typeStr.includes('unloading') 
          ? 'UNLOADING' 
          : 'LOADING';
        
        // Vérifier si une planification existe déjà pour ce matricule et cette date
        const [existing] = await operationalPool.query(
          'SELECT id_planning FROM daily_planning WHERE matricule = ? AND date_planning = ?',
          [matricule, datePlanning]
        );
        
        if (existing.length > 0) {
          // Mettre à jour l'existante
          await operationalPool.query(
            `UPDATE daily_planning 
             SET driver_name = ?, client_name = ?, id_produit = ?, operation_type = ?, 
                 planned_quantity = ?, scheduled_time = ?, status = 'PENDING', updated_at = NOW()
             WHERE id_planning = ?`,
            [chauffeur, client, produitId, operationType, quantite, heure, existing[0].id_planning]
          );
          results.warnings.push(`Ligne ${i + 1}: Planification existante mise à jour pour ${matricule}`);
        } else {
          // Créer nouvelle planification
          await operationalPool.query(
            `INSERT INTO daily_planning 
             (date_planning, matricule, driver_name, client_name, id_produit, operation_type, planned_quantity, scheduled_time, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [datePlanning, matricule, chauffeur, client, produitId, operationType, quantite, heure]
          );
          results.success++;
        }
        
      } catch (error) {
        results.errors.push(`Ligne ${i + 1}: ${error.message}`);
      }
    }
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: `Import terminé: ${results.success} planification(s) créée(s)`,
      results: {
        created: results.success,
        errors: results.errors,
        warnings: results.warnings
      }
    });
    
  } catch (error) {
    // Supprimer le fichier temporaire en cas d'erreur
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.error('Erreur lors de l\'import:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'import',
      error: error.message
    });
  }
});

/**
 * GET /api/planning/today
 * Récupère la planification du jour
 */
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const [planning] = await operationalPool.query(
      `SELECT 
        dp.*,
        p.nom_produit
       FROM daily_planning dp
       LEFT JOIN pesage_db.produits p ON dp.id_produit = p.id_produit
       WHERE dp.date_planning = ?
       ORDER BY dp.scheduled_time ASC, dp.matricule ASC`,
      [today]
    );
    
    res.json({
      success: true,
      count: planning.length,
      data: planning
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la planification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * GET /api/planning/:date
 * Récupère la planification pour une date spécifique
 */
router.get('/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    
    const [planning] = await operationalPool.query(
      `SELECT 
        dp.*,
        p.nom_produit
       FROM daily_planning dp
       LEFT JOIN pesage_db.produits p ON dp.id_produit = p.id_produit
       WHERE dp.date_planning = ?
       ORDER BY dp.scheduled_time ASC, dp.matricule ASC`,
      [date]
    );
    
    res.json({
      success: true,
      count: planning.length,
      data: planning
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la planification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * POST /api/planning
 * Crée une nouvelle entrée de planification
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date_planning, matricule, driver_name, client_name, produit, operation_type, planned_quantity, scheduled_time } = req.body;
    
    // Validation
    if (!matricule || !client_name || !produit) {
      return res.status(400).json({
        success: false,
        message: 'Matricule, Client et Produit sont requis'
      });
    }
    
    // Trouver l'ID du produit
    const [products] = await historicalPool.query(
      'SELECT id_produit FROM produits WHERE nom_produit = ? LIMIT 1',
      [produit]
    );
    
    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Produit "${produit}" non trouvé`
      });
    }
    
    const produitId = products[0].id_produit;
    const date = date_planning || new Date().toISOString().split('T')[0];
    const operation = operation_type === 'UNLOADING' ? 'UNLOADING' : 'LOADING';
    
    // Vérifier si existe déjà
    const [existing] = await operationalPool.query(
      'SELECT id_planning FROM daily_planning WHERE matricule = ? AND date_planning = ?',
      [matricule, date]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une planification existe déjà pour ce matricule et cette date'
      });
    }
    
    // Créer
    const [result] = await operationalPool.query(
      `INSERT INTO daily_planning 
       (date_planning, matricule, driver_name, client_name, id_produit, operation_type, planned_quantity, scheduled_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [date, matricule, driver_name || null, client_name, produitId, operation, planned_quantity || null, scheduled_time || null]
    );
    
    res.json({
      success: true,
      message: 'Planification créée',
      id: result.insertId
    });
    
  } catch (error) {
    console.error('Erreur lors de la création:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * PUT /api/planning/:id
 * Modifie une planification
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { driver_name, client_name, produit, operation_type, planned_quantity, scheduled_time, status } = req.body;
    
    // Vérifier que la planification existe
    const [existing] = await operationalPool.query(
      'SELECT * FROM daily_planning WHERE id_planning = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Planification non trouvée'
      });
    }
    
    const updates = [];
    const values = [];
    
    if (driver_name !== undefined) {
      updates.push('driver_name = ?');
      values.push(driver_name);
    }
    if (client_name !== undefined) {
      updates.push('client_name = ?');
      values.push(client_name);
    }
    if (produit !== undefined) {
      // Trouver l'ID du produit
      const [products] = await historicalPool.query(
        'SELECT id_produit FROM produits WHERE nom_produit = ? LIMIT 1',
        [produit]
      );
      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Produit "${produit}" non trouvé`
        });
      }
      updates.push('id_produit = ?');
      values.push(products[0].id_produit);
    }
    if (operation_type !== undefined) {
      updates.push('operation_type = ?');
      values.push(operation_type === 'UNLOADING' ? 'UNLOADING' : 'LOADING');
    }
    if (planned_quantity !== undefined) {
      updates.push('planned_quantity = ?');
      values.push(planned_quantity);
    }
    if (scheduled_time !== undefined) {
      updates.push('scheduled_time = ?');
      values.push(scheduled_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune modification fournie'
      });
    }
    
    updates.push('updated_at = NOW()');
    values.push(id);
    
    await operationalPool.query(
      `UPDATE daily_planning SET ${updates.join(', ')} WHERE id_planning = ?`,
      values
    );
    
    res.json({
      success: true,
      message: 'Planification modifiée'
    });
    
  } catch (error) {
    console.error('Erreur lors de la modification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

/**
 * DELETE /api/planning/:id
 * Supprime une planification
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await operationalPool.query(
      'DELETE FROM daily_planning WHERE id_planning = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Planification non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Planification supprimée'
    });
    
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

