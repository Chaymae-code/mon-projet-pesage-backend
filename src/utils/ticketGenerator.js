// ============================================
// GÉNÉRATEUR DE NUMÉROS DE TICKETS SÉQUENTIELS
// ============================================
// Génère des numéros de tickets numériques séquentiels
// Format: 58794, 58793, 58792, etc.

const { historicalPool } = require('../config/historicalDatabase');

/**
 * Génère le prochain numéro de ticket séquentiel
 * @returns {Promise<string>} Numéro de ticket (ex: "58794")
 */
async function generateNextTicketNumber() {
  try {
    // Récupérer le dernier numéro de ticket de la base historique
    // Les tickets sont stockés comme VARCHAR, on doit les convertir en nombres
    const [rows] = await historicalPool.query(
      `SELECT ticket 
       FROM pesages 
       WHERE ticket REGEXP '^[0-9]+$'
       ORDER BY CAST(ticket AS UNSIGNED) DESC 
       LIMIT 1`
    );

    let nextNumber;

    if (rows.length > 0 && rows[0].ticket) {
      // Incrémenter le dernier numéro
      const lastNumber = parseInt(rows[0].ticket, 10);
      nextNumber = lastNumber + 1;
    } else {
      // Aucun ticket numérique trouvé, commencer à partir d'un nombre de base
      // Vous pouvez ajuster ce nombre selon vos besoins
      nextNumber = 58000; // Commencer à 58000 si aucun ticket n'existe
    }

    return nextNumber.toString();

  } catch (error) {
    console.error('❌ Erreur lors de la génération du numéro de ticket:', error);
    
    // Fallback: utiliser un timestamp si la base n'est pas accessible
    // Mais on essaie de garder un format numérique
    const fallbackNumber = Math.floor(Date.now() / 1000) % 100000;
    return fallbackNumber.toString();
  }
}

module.exports = {
  generateNextTicketNumber
};

