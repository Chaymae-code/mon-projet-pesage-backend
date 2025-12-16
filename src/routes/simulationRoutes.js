// ============================================
// ROUTES : SIMULATION
// ============================================

const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { authenticateToken } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Upload de fichier Excel
router.post(
  '/upload',
  simulationController.upload.single('excelFile'),
  simulationController.uploadExcel
);

// Contrôle de la simulation
router.post('/start', simulationController.startSimulation);
router.post('/stop', simulationController.stopSimulation);
router.get('/status', simulationController.getStatus);
router.post('/reset', simulationController.resetSimulation);
router.post('/auto-start', simulationController.autoStart); // Auto-démarrage

module.exports = router;

