// ============================================
// ROUTES : CATÉGORIES
// ============================================
// Définit les URLs pour gérer les catégories

const express = require('express');
const router = express.Router();

// Importe les fonctions du contrôleur
const categorieController = require('../controllers/categorieController');

// Importe le middleware d'authentification
const { authenticateToken } = require('../middleware/auth');

// Applique l'authentification à toutes les routes
router.use(authenticateToken);

// ============================
// ROUTES CRUD COMPLETES
// ============================

// 1. GET /api/categories
//    Récupère TOUTES les catégories
router.get('/', categorieController.getAllCategories);

// 2. GET /api/categories/:id
//    Récupère UNE catégorie par son ID
router.get('/:id', categorieController.getCategorieById);

// 3. POST /api/categories
//    Crée une NOUVELLE catégorie
router.post('/', categorieController.createCategorie);

// 4. PUT /api/categories/:id
//    Met à jour une catégorie existante
router.put('/:id', categorieController.updateCategorie);

// 5. DELETE /api/categories/:id
//    Supprime une catégorie
router.delete('/:id', categorieController.deleteCategorie);

// ============================
// EXPORT DU ROUTER
// ============================
// Exporte le router pour l'utiliser dans server.js
module.exports = router;