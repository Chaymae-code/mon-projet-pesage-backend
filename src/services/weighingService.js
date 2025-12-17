// ============================================
// SERVICE : GESTION DES PESAGES ACTIFS
// ============================================
// Gère le workflow de pesage en temps réel
// États : ARRIVAL → ENTRY_WEIGHING → LOADING/UNLOADING → EXIT_WEIGHING → COMPLETED

const { operationalPool } = require('../config/operationalDatabase');

class WeighingService {
  /**
   * Crée un pesage actif (après autorisation OpenCV)
   * ⭐ Appelé après détection et autorisation
   * @param {Object} weighingData - Données du pesage
   * @returns {Promise<Object>} Pesage créé
   */
  async createActiveWeighing(weighingData) {
    const {
      id_planning,
      matricule,
      client_name,
      id_produit,
      operation_type
    } = weighingData;

    try {
      const [result] = await operationalPool.query(
        `INSERT INTO active_weighings 
         (id_planning, matricule, client_name, id_produit, operation_type, 
          current_state, arrival_time)
         VALUES (?, ?, ?, ?, ?, 'ARRIVAL', NOW())`,
        [id_planning, matricule, client_name, id_produit, operation_type]
      );

      const weighing = await this.getActiveWeighingById(result.insertId);

      return {
        success: true,
        weighing: weighing,
        message: 'Pesage actif créé avec succès'
      };
    } catch (error) {
      console.error('Erreur création pesage actif:', error);
      throw error;
    }
  }

  /**
   * Met à jour l'état d'un pesage
   * @param {number} id_weighing - ID du pesage
   * @param {string} newState - Nouvel état
   * @param {Object} additionalData - Données supplémentaires (poids, timestamps)
   * @returns {Promise<Object>} Pesage mis à jour
   */
  async updateState(id_weighing, newState, additionalData = {}) {
    try {
      const updateFields = ['current_state = ?'];
      const updateValues = [newState];

      // Mettre à jour le timestamp approprié selon l'état
      if (newState === 'ENTRY_WEIGHING' && !additionalData.entry_weighing_time) {
        updateFields.push('entry_weighing_time = NOW()');
      } else if ((newState === 'LOADING' || newState === 'UNLOADING') && !additionalData.zone_entry_time) {
        updateFields.push('zone_entry_time = NOW()');
      } else if (newState === 'EXIT_WEIGHING' && !additionalData.exit_weighing_time) {
        updateFields.push('exit_weighing_time = NOW()');
      } else if (newState === 'COMPLETED' && !additionalData.completion_time) {
        updateFields.push('completion_time = NOW()');
      }

      // Ajouter les poids si fournis
      if (additionalData.entry_weight !== undefined) {
        updateFields.push('entry_weight = ?');
        updateValues.push(additionalData.entry_weight);
      }
      if (additionalData.exit_weight !== undefined) {
        updateFields.push('exit_weight = ?');
        updateValues.push(additionalData.exit_weight);
      }
      if (additionalData.tare !== undefined) {
        updateFields.push('tare = ?');
        updateValues.push(additionalData.tare);
      }
      if (additionalData.brut !== undefined) {
        updateFields.push('brut = ?');
        updateValues.push(additionalData.brut);
      }
      if (additionalData.net !== undefined) {
        updateFields.push('net = ?');
        updateValues.push(additionalData.net);
      }
      if (additionalData.ticket_number) {
        updateFields.push('ticket_number = ?');
        updateValues.push(additionalData.ticket_number);
      }

      updateValues.push(id_weighing);

      await operationalPool.query(
        `UPDATE active_weighings SET ${updateFields.join(', ')} WHERE id_weighing = ?`,
        updateValues
      );

      return await this.getActiveWeighingById(id_weighing);
    } catch (error) {
      console.error('Erreur mise à jour état:', error);
      throw error;
    }
  }

  /**
   * Met à jour le poids (depuis le calculateur)
   * @param {number} id_weighing - ID du pesage
   * @param {number} weight - Poids en tonnes
   * @param {string} type - 'entry' ou 'exit'
   * @returns {Promise<Object>} Pesage mis à jour
   */
  async updateWeight(id_weighing, weight, type = 'entry') {
    try {
      const field = type === 'entry' ? 'entry_weight' : 'exit_weight';
      
      await operationalPool.query(
        `UPDATE active_weighings SET ${field} = ? WHERE id_weighing = ?`,
        [weight, id_weighing]
      );

      return await this.getActiveWeighingById(id_weighing);
    } catch (error) {
      console.error('Erreur mise à jour poids:', error);
      throw error;
    }
  }

  /**
   * Calcule tare, brut et net selon l'opération
   * @param {number} id_weighing - ID du pesage
   * @returns {Promise<Object>} Poids calculés
   */
  async calculateWeights(id_weighing) {
    try {
      const weighing = await this.getActiveWeighingById(id_weighing);

      if (!weighing.entry_weight || !weighing.exit_weight) {
        throw new Error('Les deux pesages doivent être effectués');
      }

      let tare, brut, net;

      if (weighing.operation_type === 'LOADING') {
        // Chargement : TARE en premier, BRUT en second
        tare = weighing.entry_weight;
        brut = weighing.exit_weight;
        net = parseFloat((brut - tare).toFixed(3));
      } else {
        // Déchargement : BRUT en premier, TARE en second
        brut = weighing.entry_weight;
        tare = weighing.exit_weight;
        net = parseFloat((brut - tare).toFixed(3));
      }

      // Mettre à jour les poids calculés
      await operationalPool.query(
        `UPDATE active_weighings 
         SET tare = ?, brut = ?, net = ?
         WHERE id_weighing = ?`,
        [tare, brut, net, id_weighing]
      );

      return { tare, brut, net };
    } catch (error) {
      console.error('Erreur calcul poids:', error);
      throw error;
    }
  }

  /**
   * Finalise un pesage (génère ticket, calcule poids finaux)
   * @param {number} id_weighing - ID du pesage
   * @returns {Promise<Object>} Pesage finalisé
   */
  async completeWeighing(id_weighing) {
    try {
      // Calculer les poids finaux
      await this.calculateWeights(id_weighing);

      // Générer ticket
      const ticketNumber = `TKT-${Date.now()}`;

      // Mettre à jour l'état
      const weighing = await this.updateState(id_weighing, 'COMPLETED', {
        ticket_number: ticketNumber
      });

      return weighing;
    } catch (error) {
      console.error('Erreur finalisation pesage:', error);
      throw error;
    }
  }

  /**
   * Récupère un pesage actif par ID
   * @param {number} id_weighing - ID du pesage
   * @returns {Promise<Object>} Pesage
   */
  async getActiveWeighingById(id_weighing) {
    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM active_weighings WHERE id_weighing = ?`,
        [id_weighing]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      console.error('Erreur récupération pesage:', error);
      throw error;
    }
  }

  /**
   * Récupère tous les pesages actifs (pour dashboard)
   * @param {string} state - Filtrer par état (optionnel)
   * @returns {Promise<Array>} Liste des pesages actifs
   */
  async getActiveWeighings(state = null) {
    try {
      let query = `SELECT * FROM active_weighings WHERE current_state != 'COMPLETED'`;
      const params = [];

      if (state) {
        query += ` AND current_state = ?`;
        params.push(state);
      }

      query += ` ORDER BY created_at DESC`;

      const [rows] = await operationalPool.query(query, params);

      return rows;
    } catch (error) {
      console.error('Erreur récupération pesages actifs:', error);
      throw error;
    }
  }

  /**
   * Récupère les pesages complétés (pour transfert vers historique)
   * @returns {Promise<Array>} Liste des pesages complétés
   */
  async getCompletedWeighings() {
    try {
      const [rows] = await operationalPool.query(
        `SELECT * FROM active_weighings WHERE current_state = 'COMPLETED'`
      );

      return rows;
    } catch (error) {
      console.error('Erreur récupération pesages complétés:', error);
      throw error;
    }
  }
}

module.exports = new WeighingService();

