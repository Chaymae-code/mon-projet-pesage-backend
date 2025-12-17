// ============================================
// SERVICE : GESTION DES QUOTAS CLIENTS
// ============================================
// Gère les quotas clients et le blocage automatique

const { operationalPool } = require('../config/operationalDatabase');

class QuotaService {
  /**
   * Vérifie si un client a un quota disponible
   * ⭐ Utilisé lors de l'autorisation après détection OpenCV
   * @param {string} clientName - Nom du client
   * @returns {Promise<Object>} { available: boolean, quota: Object, reason: string }
   */
  async checkClientQuota(clientName) {
    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ?`,
        [clientName]
      );

      if (rows.length === 0) {
        // Client sans quota défini = autorisé par défaut
        return {
          available: true,
          quota: null,
          reason: 'Aucun quota défini pour ce client'
        };
      }

      const quota = rows[0];

      if (quota.is_blocked) {
        return {
          available: false,
          quota: quota,
          reason: 'Client bloqué - Quota dépassé'
        };
      }

      if (quota.remaining_quota <= 0) {
        return {
          available: false,
          quota: quota,
          reason: 'Quota épuisé'
        };
      }

      return {
        available: true,
        quota: quota,
        reason: 'Quota disponible'
      };
    } catch (error) {
      console.error('Erreur vérification quota:', error);
      throw error;
    }
  }

  /**
   * Consomme du quota après un pesage complété
   * @param {string} clientName - Nom du client
   * @param {number} netWeight - Poids net en tonnes
   * @returns {Promise<Object>} Quota mis à jour
   */
  async consumeQuota(clientName, netWeight) {
    try {
      // Vérifier si le client existe
      const [rows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ?`,
        [clientName]
      );

      if (rows.length === 0) {
        // Créer un quota par défaut si n'existe pas
        await operationalPool.query(
          `INSERT INTO client_quotas (client_name, total_quota, consumed_quota)
           VALUES (?, 1000.000, ?)`,
          [clientName, netWeight]
        );
      } else {
        // Mettre à jour le quota consommé
        await operationalPool.query(
          `UPDATE client_quotas 
           SET consumed_quota = consumed_quota + ?,
               updated_at = NOW()
           WHERE client_name = ?`,
          [netWeight, clientName]
        );
      }

      // Vérifier si le quota est dépassé et bloquer si nécessaire
      await this.blockClientIfExceeded(clientName);

      // Récupérer le quota mis à jour
      const [updatedRows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ?`,
        [clientName]
      );

      return updatedRows[0];
    } catch (error) {
      console.error('Erreur consommation quota:', error);
      throw error;
    }
  }

  /**
   * Bloque un client si son quota est dépassé
   * @param {string} clientName - Nom du client
   * @returns {Promise<boolean>} True si bloqué, false sinon
   */
  async blockClientIfExceeded(clientName) {
    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ?`,
        [clientName]
      );

      if (rows.length === 0) {
        return false;
      }

      const quota = rows[0];

      if (quota.consumed_quota > quota.total_quota && !quota.is_blocked) {
        await operationalPool.query(
          `UPDATE client_quotas 
           SET is_blocked = TRUE, blocked_at = NOW()
           WHERE client_name = ?`,
          [clientName]
        );

        console.log(`⚠️ Client ${clientName} bloqué - Quota dépassé`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur blocage client:', error);
      throw error;
    }
  }

  /**
   * Crée ou met à jour un quota client
   * @param {Object} quotaData - Données du quota
   * @returns {Promise<Object>} Quota créé/mis à jour
   */
  async upsertQuota(quotaData) {
    const { client_name, total_quota, consumed_quota = 0 } = quotaData;

    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM client_quotas WHERE client_name = ?`,
        [client_name]
      );

      if (rows.length === 0) {
        // Créer
        const [result] = await operationalPool.query(
          `INSERT INTO client_quotas (client_name, total_quota, consumed_quota)
           VALUES (?, ?, ?)`,
          [client_name, total_quota, consumed_quota]
        );

        return { id_quota: result.insertId, ...quotaData };
      } else {
        // Mettre à jour
        await operationalPool.query(
          `UPDATE client_quotas 
           SET total_quota = ?, consumed_quota = ?, is_blocked = FALSE, blocked_at = NULL
           WHERE client_name = ?`,
          [total_quota, consumed_quota, client_name]
        );

        const [updatedRows] = await operationalPool.query(
          `SELECT * FROM client_quotas WHERE client_name = ?`,
          [client_name]
        );

        return updatedRows[0];
      }
    } catch (error) {
      console.error('Erreur upsert quota:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les quotas
   * @returns {Promise<Array>} Liste des quotas
   */
  async getAllQuotas() {
    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM client_quotas ORDER BY client_name ASC`
      );

      return rows;
    } catch (error) {
      console.error('Erreur récupération quotas:', error);
      throw error;
    }
  }
}

module.exports = new QuotaService();

