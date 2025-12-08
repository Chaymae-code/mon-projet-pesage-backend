// ============================================
// ROUTES : PRODUITS
// ============================================
// Définit les URLs pour gérer les produits

const express = require('express');
const router = express.Router();

// Importe les fonctions du contrôleur
const produitController = require('../controllers/produitController');

// ============================
// ROUTES CRUD COMPLETES
// ============================

// 1. GET /api/produits
//    Récupère TOUS les produits (avec catégories)
router.get('/', produitController.getAllProduits);

// 2. GET /api/produits/:id
//    Récupère UN produit par son ID
router.get('/:id', produitController.getProduitById);

// 3. POST /api/produits
//    Crée un NOUVEAU produit
router.post('/', produitController.createProduit);

// 4. PUT /api/produits/:id
//    Met à jour un produit existant
router.put('/:id', produitController.updateProduit);

// 5. DELETE /api/produits/:id
//    Supprime un produit
router.delete('/:id', produitController.deleteProduit);

// ============================
// EXPORT DU ROUTER
// ============================
module.exports = router;