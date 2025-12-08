// ============================================
// ROUTES : PESAGES
// ============================================
// Définit les URLs pour gérer les pesages

const express = require('express');
const router = express.Router();

// Importe les fonctions du contrôleur
const pesageController = require('../controllers/pesageController');

// ============================
// ROUTES CRUD COMPLETES
// ============================

// 1. GET /api/pesages
router.get('/', pesageController.getAllPesages);

// 2. GET /api/pesages/stats  ← DOIT ÊTRE AVANT /:id !
router.get('/stats', pesageController.getStats);

// 3. GET /api/pesages/:id
router.get('/:id', pesageController.getPesageById);

// 4. POST /api/pesages
router.post('/', pesageController.createPesage);

// 5. PUT /api/pesages/:id
router.put('/:id', pesageController.updatePesage);

// 6. DELETE /api/pesages/:id
router.delete('/:id', pesageController.deletePesage);

// ============================
// ROUTES SPÉCIALES
// ============================

// 6. GET /api/pesages/stats
//    Récupère les statistiques des pesages
router.get('/stats', pesageController.getStats);

// ============================
// EXPORT DU ROUTER
// ============================
module.exports = router;