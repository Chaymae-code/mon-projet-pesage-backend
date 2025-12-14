// ============================================
// MIDDLEWARE D'AUTHENTIFICATION JWT
// ============================================
// Vérifie les tokens JWT pour protéger les routes

const jwt = require('jsonwebtoken');

// Secret JWT - doit correspondre à celui du backend d'authentification
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * Middleware pour authentifier les requêtes avec JWT
 * Vérifie le token dans le header Authorization: Bearer <token>
 */
const authenticateToken = (req, res, next) => {
  // Récupère le header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  // Si pas de token
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token d\'accès requis. Veuillez vous connecter.'
    });
  }

  // Vérifie le token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // Ajoute les informations de l'utilisateur à la requête
    req.user = decoded;
    next();
  });
};

/**
 * Middleware optionnel pour vérifier le rôle admin
 * À utiliser après authenticateToken
 */
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Accès administrateur requis'
  });
};

module.exports = {
  authenticateToken,
  requireAdmin
};

