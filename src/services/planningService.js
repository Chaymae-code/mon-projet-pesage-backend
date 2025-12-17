// ============================================
// SERVICE : PLANIFICATION QUOTIDIENNE
// ============================================
// Gère la planification quotidienne des camions
// Utilisé pour vérifier l'autorisation après détection OpenCV

const { operationalPool } = require('../config/operationalDatabase');

class PlanningService {
  /**
   * Crée une nouvelle entrée de planification
   * @param {Object} planningData - Données de planification
   * @returns {Promise<Object>} Planning créé
   */
  async createPlanning(planningData) {
    const {
      date_planning,
      matricule,
      driver_name,
      client_name,
      id_produit,
      operation_type,
      planned_quantity,
      scheduled_time
    } = planningData;

    try {
      const [result] = await operationalPool.query(
        `INSERT INTO daily_planning 
         (date_planning, matricule, driver_name, client_name, id_produit, 
          operation_type, planned_quantity, scheduled_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date_planning,
          matricule,
          driver_name || null,
          client_name,
          id_produit,
          operation_type,
          planned_quantity || null,
          scheduled_time || null
        ]
      );

      return {
        success: true,
        id_planning: result.insertId,
        message: 'Planification créée avec succès'
      };
    } catch (error) {
      console.error('Erreur création planification:', error);
      throw error;
    }
  }

  /**
   * Récupère la planification du jour
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Promise<Array>} Liste des planifications
   */
  async getTodayPlanning(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM daily_planning 
         WHERE date_planning = ? 
         ORDER BY scheduled_time ASC, matricule ASC`,
        [targetDate]
      );

      return rows;
    } catch (error) {
      console.error('Erreur récupération planification:', error);
      throw error;
    }
  }

  /**
   * Vérifie si un matricule est planifié pour aujourd'hui
   * ⭐ Utilisé par OpenCV après détection
   * @param {string} matricule - Matricule détecté
   * @param {string} date - Date au format YYYY-MM-DD (optionnel, défaut: aujourd'hui)
   * @returns {Promise<Object|null>} Planning trouvé ou null
   */
  async findPlanningByMatricule(matricule, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM daily_planning 
         WHERE matricule = ? AND date_planning = ? AND status = 'PENDING'`,
        [matricule, targetDate]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      console.error('Erreur recherche planification:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une planification
   * @param {number} id_planning - ID de la planification
   * @param {string} status - Nouveau statut
   * @returns {Promise<boolean>} Succès
   */
  async updatePlanningStatus(id_planning, status) {
    try {
      await operationalPool.query(
        `UPDATE daily_planning SET status = ? WHERE id_planning = ?`,
        [status, id_planning]
      );

      return true;
    } catch (error) {
      console.error('Erreur mise à jour statut planification:', error);
      throw error;
    }
  }

  /**
   * Supprime une planification
   * @param {number} id_planning - ID de la planification
   * @returns {Promise<boolean>} Succès
   */
  async deletePlanning(id_planning) {
    try {
      await operationalPool.query(
        `DELETE FROM daily_planning WHERE id_planning = ?`,
        [id_planning]
      );

      return true;
    } catch (error) {
      console.error('Erreur suppression planification:', error);
      throw error;
    }
  }
}

module.exports = new PlanningService();

