// ============================================
// CONTRÔLEUR : SIMULATION
// ============================================
// Gère les opérations de simulation de pesage avec logique 1er/2e pesage

const multer = require('multer');
const { parseExcelFile } = require('../utils/excelParser');
const simulationService = require('../services/simulationService');

// Configuration de multer pour l'upload de fichiers
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les fichiers Excel
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers Excel (.xlsx, .xls) sont acceptés'));
    }
  }
});

/**
 * Upload et parse un fichier Excel
 * POST /api/simulation/upload
 */
const uploadExcel = async (req, res) => {
  console.log('📥 Upload de fichier Excel pour simulation');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Parser le fichier Excel
    const pesagesData = parseExcelFile(req.file.buffer);

    if (pesagesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée de pesage trouvée dans le fichier'
      });
    }

    // Charger les données dans le service de simulation
    const config = {
      intervalArrivee: parseInt(req.body.intervalArrivee) || 30000, // 30s par défaut
      delaiZoneMin: parseInt(req.body.delaiZoneMin) || 120, // 2 min
      delaiZoneMax: parseInt(req.body.delaiZoneMax) || 300, // 5 min
      speed: parseFloat(req.body.speed) || 1,
      startDate: req.body.startDate || new Date().toISOString().split('T')[0]
    };

    simulationService.loadData(pesagesData, config);

    res.json({
      success: true,
      message: `${pesagesData.length} pesages chargés avec succès`,
      data: {
        count: pesagesData.length,
        config: config,
        preview: pesagesData.slice(0, 5) // Aperçu des 5 premiers
      }
    });

  } catch (error) {
    console.error('❌ Erreur upload Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du fichier Excel',
      error: error.message
    });
  }
};

/**
 * Démarre la simulation
 * POST /api/simulation/start
 */
const startSimulation = async (req, res) => {
  console.log('🚀 Démarrage de la simulation');
  
  try {
    simulationService.start();
    
    res.json({
      success: true,
      message: 'Simulation démarrée',
      status: simulationService.getStatus()
    });
  } catch (error) {
    console.error('❌ Erreur démarrage simulation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors du démarrage de la simulation'
    });
  }
};

/**
 * Arrête la simulation
 * POST /api/simulation/stop
 */
const stopSimulation = async (req, res) => {
  console.log('⏹️ Arrêt de la simulation');
  
  try {
    simulationService.stop();
    
    res.json({
      success: true,
      message: 'Simulation arrêtée',
      status: simulationService.getStatus()
    });
  } catch (error) {
    console.error('❌ Erreur arrêt simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'arrêt de la simulation'
    });
  }
};

/**
 * Obtient le statut de la simulation
 * GET /api/simulation/status
 */
const getStatus = async (req, res) => {
  try {
    const status = simulationService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Erreur statut simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut'
    });
  }
};

/**
 * Réinitialise la simulation
 * POST /api/simulation/reset
 */
const resetSimulation = async (req, res) => {
  console.log('🔄 Réinitialisation de la simulation');
  
  try {
    simulationService.reset();
    
    res.json({
      success: true,
      message: 'Simulation réinitialisée',
      status: simulationService.getStatus()
    });
  } catch (error) {
    console.error('❌ Erreur réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation'
    });
  }
};

/**
 * Auto-démarre la simulation si elle n'est pas déjà en cours
 * POST /api/simulation/auto-start
 */
const autoStart = async (req, res) => {
  console.log('🚀 Auto-démarrage de la simulation');
  
  try {
    const result = await simulationService.autoStart();
    
    res.json({
      success: true,
      message: result.message,
      status: result.status || simulationService.getStatus()
    });
  } catch (error) {
    console.error('❌ Erreur auto-démarrage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage automatique',
      error: error.message
    });
  }
};

module.exports = {
  uploadExcel,
  startSimulation,
  stopSimulation,
  getStatus,
  resetSimulation,
  autoStart,
  upload // Export multer pour les routes
};

