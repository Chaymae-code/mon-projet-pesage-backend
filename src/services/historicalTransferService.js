// ============================================
// SERVICE : TRANSFERT VERS BASE HISTORIQUE
// ============================================
// Transfère automatiquement les pesées COMPLETED
// de la base opérationnelle vers la base historique (pesage_data)

const { operationalPool } = require('../config/operationalDatabase');
const { historicalPool } = require('../config/historicalDatabase');

class HistoricalTransferService {
  /**
   * Formate une date en gardant le jour local (évite le décalage UTC)
   */
  formatDateLocal(dateObj) {
    if (!dateObj) return new Date().toISOString().slice(0, 10);
    const local = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  /**
   * Transfère un pesage complété vers la base historique
   * @param {number} weighingId - ID du pesage dans active_weighings
   */
  async transferCompletedWeighing(weighingId) {
    try {
      console.log(`📤 [${weighingId}] Début du transfert vers l'historique...`);

      // 1. Récupérer le pesage complété
      const [weighings] = await operationalPool.query(
        `SELECT * FROM active_weighings WHERE id_weighing = ? AND current_state = 'COMPLETED' LIMIT 1`,
        [weighingId]
      );

      if (weighings.length === 0) {
        console.warn(`⚠️  [${weighingId}] Pesage non trouvé ou non complété`);
        return { success: false, message: 'Pesage non trouvé ou non complété' };
      }

      const weighing = weighings[0];

      // Vérifier que les données essentielles sont présentes
      if (!weighing.tare || !weighing.brut || !weighing.net || !weighing.ticket_number) {
        console.warn(`⚠️  [${weighingId}] Données incomplètes pour le transfert`);
        return { success: false, message: 'Données incomplètes' };
      }

      // 2. Récupérer ou créer le matricule dans la base historique
      const matriculeId = await this.getOrCreateMatricule(
        weighing.matricule,
        weighing.client_name,
        weighing.id_produit
      );

      if (!matriculeId) {
        return { success: false, message: 'Impossible de créer/récupérer le matricule' };
      }

      // 3. Récupérer ou créer le client dans la base historique
      const clientId = await this.getOrCreateClient(
        weighing.client_name,
        weighing.id_produit
      );

      if (!clientId) {
        return { success: false, message: 'Impossible de créer/récupérer le client' };
      }

      // 4. Récupérer ou créer le produit dans la base historique
      const produitId = await this.getOrCreateProduit(weighing.id_produit);

      if (!produitId) {
        return { success: false, message: 'Impossible de créer/récupérer le produit' };
      }

      // 5. Vérifier si le pesage existe déjà (éviter les doublons)
      const [existing] = await historicalPool.query(
        'SELECT id FROM pesages WHERE ticket = ? LIMIT 1',
        [weighing.ticket_number]
      );

      if (existing.length > 0) {
        console.log(`ℹ️  [${weighingId}] Pesage déjà présent dans l'historique (ticket: ${weighing.ticket_number})`);
        return { success: true, message: 'Déjà transféré', existing: true };
      }

      // 6. Extraire date et heure depuis les timestamps (en conservant le jour local)
      const date = this.formatDateLocal(weighing.completion_time);
      const heure = weighing.completion_time
        ? new Date(weighing.completion_time).toTimeString().split(' ')[0]
        : new Date().toTimeString().split(' ')[0];

      // 7. Insérer dans la base historique
      const [result] = await historicalPool.query(
        `INSERT INTO pesages 
         (date, matricule_id, heure, ticket, client_id, produit_id, brut, tare, net)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date,
          matriculeId,
          heure,
          weighing.ticket_number,
          clientId,
          produitId,
          parseFloat(weighing.brut),
          parseFloat(weighing.tare),
          parseFloat(weighing.net)
        ]
      );

      console.log(`✅ [${weighingId}] Pesage transféré vers l'historique (ID historique: ${result.insertId})`);

      return {
        success: true,
        historicalId: result.insertId,
        message: 'Transfert réussi'
      };

    } catch (error) {
      console.error(`❌ [${weighingId}] Erreur lors du transfert:`, error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Récupère ou crée un matricule dans la base historique
   */
  async getOrCreateMatricule(codeMatricule, clientName, produitId) {
    try {
      // Chercher le matricule existant
      const [existing] = await historicalPool.query(
        'SELECT id FROM matricules WHERE code_matricule = ? LIMIT 1',
        [codeMatricule]
      );

      if (existing.length > 0) {
        return existing[0].id;
      }

      // Créer le matricule (nécessite client_id)
      const clientId = await this.getOrCreateClient(clientName, produitId);
      if (!clientId) {
        throw new Error('Impossible de créer le client pour le matricule');
      }

      const [result] = await historicalPool.query(
        `INSERT INTO matricules (code_matricule, client_id, actif)
         VALUES (?, ?, 1)`,
        [codeMatricule, clientId]
      );

      console.log(`   ✅ Matricule créé: ${codeMatricule} (ID: ${result.insertId})`);
      return result.insertId;

    } catch (error) {
      console.error(`   ❌ Erreur getOrCreateMatricule:`, error);
      throw error;
    }
  }

  /**
   * Récupère ou crée un client dans la base historique
   */
  async getOrCreateClient(nomClient, produitId) {
    try {
      // Chercher le client existant
      const [existing] = await historicalPool.query(
        'SELECT id FROM clients WHERE nom_client = ? LIMIT 1',
        [nomClient]
      );

      if (existing.length > 0) {
        return existing[0].id;
      }

      // Créer le client
      const produitIdHistorical = await this.getOrCreateProduit(produitId);
      
      const [result] = await historicalPool.query(
        `INSERT INTO clients (nom_client, produit_id, actif)
         VALUES (?, ?, 1)`,
        [nomClient, produitIdHistorical || null]
      );

      console.log(`   ✅ Client créé: ${nomClient} (ID: ${result.insertId})`);
      return result.insertId;

    } catch (error) {
      console.error(`   ❌ Erreur getOrCreateClient:`, error);
      throw error;
    }
  }

  /**
   * Récupère ou crée un produit dans la base historique
   * En utilisant l'ID de la base opérationnelle pour trouver le nom
   */
  async getOrCreateProduit(produitIdOperational) {
    try {
      // L'id_produit dans active_weighings correspond déjà à l'ID dans la base historique
      // Vérifier directement dans la base historique
      const [produitRows] = await historicalPool.query(
        'SELECT id, nom_produit FROM produits WHERE id = ? LIMIT 1',
        [produitIdOperational]
      );

      if (produitRows.length > 0) {
        // Le produit existe déjà dans la base historique
        return produitRows[0].id;
      }

      // Si le produit n'existe pas, essayer de le récupérer depuis la planification
      // ou utiliser un nom par défaut
      console.warn(`   ⚠️  Produit ${produitIdOperational} non trouvé dans la base historique`);
      
      // Essayer de récupérer depuis la planification via active_weighings
      const [planningRows] = await operationalPool.query(
        `SELECT dp.product_name 
         FROM active_weighings aw
         LEFT JOIN daily_planning dp ON aw.id_planning = dp.id_planning
         WHERE aw.id_produit = ? AND dp.product_name IS NOT NULL
         LIMIT 1`,
        [produitIdOperational]
      );

      let nomProduit = 'Produit Inconnu';
      if (planningRows.length > 0 && planningRows[0].product_name) {
        nomProduit = planningRows[0].product_name;
      }

      // Créer le produit dans la base historique
      const [result] = await historicalPool.query(
        `INSERT INTO produits (nom_produit, prix, actif)
         VALUES (?, 0.00, 1)`,
        [nomProduit]
      );

      console.log(`   ✅ Produit créé: ${nomProduit} (ID: ${result.insertId})`);
      return result.insertId;

    } catch (error) {
      console.error(`   ❌ Erreur getOrCreateProduit:`, error);
      return null;
    }
  }
}

// Instance singleton
const transferService = new HistoricalTransferService();

module.exports = transferService;


