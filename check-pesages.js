require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/database');

async function checkPesages() {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ps.id_pesage,
        ps.camion,
        ps.client,
        pr.nom_produit,
        ps.statut,
        ps.date_pesage
      FROM pesages ps
      LEFT JOIN produits pr ON ps.id_produit = pr.id_produit
      ORDER BY ps.id_pesage DESC
      LIMIT 30
    `);
    
    console.log('📋 30 derniers pesages dans la base:');
    console.log('─'.repeat(80));
    rows.forEach((r, i) => {
      console.log(`${i + 1}. ID: ${r.id_pesage} | Matricule: "${r.camion}" | Produit: "${r.nom_produit}" | Client: "${r.client}" | Statut: "${r.statut}" | Date: "${r.date_pesage}"`);
    });
    
    // Chercher les pesages avec format CSV
    const pesagesCSV = rows.filter(r => 
      r.camion && 
      /^\d+[A-Z]\d+$/.test(r.camion.trim()) &&
      r.camion !== 'MATRICULE'
    );
    
    console.log('\n🔍 Pesages avec format CSV (chiffres+lettre+chiffres):');
    console.log(`   Trouvés: ${pesagesCSV.length} pesages`);
    if (pesagesCSV.length > 0) {
      pesagesCSV.slice(0, 5).forEach(r => {
        console.log(`   - ${r.camion} | ${r.nom_produit} | ${r.client}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkPesages();

