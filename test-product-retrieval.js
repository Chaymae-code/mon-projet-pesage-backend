// Test de récupération du produit
require('dotenv').config();
const { pool: historicalPool } = require('./src/config/database');
const { operationalPool } = require('./src/config/operationalDatabase');

async function test() {
  try {
    // Récupérer la planification
    const today = new Date().toISOString().split('T')[0];
    const [planning] = await operationalPool.query(
      'SELECT * FROM daily_planning WHERE matricule = ? AND date_planning = ?',
      ['792A81', today]
    );
    
    if (planning.length > 0) {
      console.log('Planification trouvée:', planning[0]);
      console.log('ID Produit:', planning[0].id_produit);
      console.log('Client:', planning[0].client_name);
      
      // Récupérer le produit
      const [products] = await historicalPool.query(
        'SELECT nom_produit FROM produits WHERE id_produit = ?',
        [planning[0].id_produit]
      );
      
      if (products.length > 0) {
        console.log('Produit trouvé:', products[0].nom_produit);
      } else {
        console.log('Produit non trouvé pour ID:', planning[0].id_produit);
      }
    } else {
      console.log('Planification non trouvée');
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await historicalPool.end();
    await operationalPool.end();
  }
}

test();




