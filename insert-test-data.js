/**
 * Script pour insérer des données de test dans la base de données
 * Utile pour tester la connexion frontend-backend
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function insertTestData() {
  console.log('📝 Insertion de données de test...\n');
  console.log('='.repeat(60));

  try {
    // Vérifier si des catégories existent
    console.log('\n1️⃣ Vérification des catégories...');
    const [categories] = await pool.query('SELECT * FROM categories LIMIT 1');
    
    let categorieId;
    if (categories.length === 0) {
      console.log('   Aucune catégorie trouvée, création d\'une catégorie de test...');
      const [result] = await pool.query(
        'INSERT INTO categories (nom_categorie) VALUES (?)',
        ['Test Catégorie']
      );
      categorieId = result.insertId;
      console.log(`   ✅ Catégorie créée avec ID: ${categorieId}`);
    } else {
      categorieId = categories[0].id_categorie;
      console.log(`   ✅ Catégorie existante trouvée (ID: ${categorieId})`);
    }

    // Vérifier si des produits existent
    console.log('\n2️⃣ Vérification des produits...');
    const [produits] = await pool.query('SELECT * FROM produits LIMIT 1');
    
    let produitId;
    if (produits.length === 0) {
      console.log('   Aucun produit trouvé, création d\'un produit de test...');
      const [result] = await pool.query(
        'INSERT INTO produits (nom_produit, id_categorie, nombre_camions, tonnage) VALUES (?, ?, ?, ?)',
        ['Produit Test', categorieId, 0, 0.0]
      );
      produitId = result.insertId;
      console.log(`   ✅ Produit créé avec ID: ${produitId}`);
    } else {
      produitId = produits[0].id_produit;
      console.log(`   ✅ Produit existant trouvé (ID: ${produitId})`);
    }

    // Vérifier si des pesages existent déjà
    console.log('\n3️⃣ Vérification des pesages existants...');
    const [existingPesages] = await pool.query('SELECT COUNT(*) as total FROM pesages');
    const total = existingPesages[0].total;
    console.log(`   📊 Pesages existants: ${total}`);

    if (total > 0) {
      console.log('   ⚠️  Des pesages existent déjà. Voulez-vous quand même ajouter des données de test ?');
      console.log('   💡 Pour forcer l\'insertion, modifiez ce script.');
      return;
    }

    // Insérer des pesages de test
    console.log('\n4️⃣ Insertion de pesages de test...');
    
    const testPesages = [
      {
        id_produit: produitId,
        date_pesage: new Date().toISOString().split('T')[0], // Aujourd'hui
        camion: 'AB-123-CD',
        heure: '10:30:00',
        ticket: 'TKT-001',
        tare: 10.5,
        brut: 35.8,
        net: 25.3
      },
      {
        id_produit: produitId,
        date_pesage: new Date().toISOString().split('T')[0], // Aujourd'hui
        camion: 'EF-456-GH',
        heure: '11:15:00',
        ticket: 'TKT-002',
        tare: 12.0,
        brut: 40.5,
        net: 28.5
      },
      {
        id_produit: produitId,
        date_pesage: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Hier
        camion: 'IJ-789-KL',
        heure: '14:20:00',
        ticket: 'TKT-003',
        tare: 11.2,
        brut: 38.0,
        net: 26.8
      },
      {
        id_produit: produitId,
        date_pesage: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Hier
        camion: 'MN-012-OP',
        heure: '16:45:00',
        ticket: 'TKT-004',
        tare: 13.5,
        brut: 42.3,
        net: 28.8
      },
      {
        id_produit: produitId,
        date_pesage: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], // Il y a 2 jours
        camion: 'QR-345-ST',
        heure: '09:00:00',
        ticket: 'TKT-005',
        tare: 10.8,
        brut: 36.2,
        net: 25.4
      }
    ];

    let inserted = 0;
    for (const pesage of testPesages) {
      await pool.query(
        `INSERT INTO pesages 
         (id_produit, date_pesage, camion, heure, ticket, tare, brut, net) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pesage.id_produit,
          pesage.date_pesage,
          pesage.camion,
          pesage.heure,
          pesage.ticket,
          pesage.tare,
          pesage.brut,
          pesage.net
        ]
      );
      inserted++;
      console.log(`   ✅ Pesage ${inserted} inséré: ${pesage.camion} - ${pesage.date_pesage}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ ${inserted} pesages de test insérés avec succès !`);
    console.log('\n💡 Vous pouvez maintenant :');
    console.log('   1. Rafraîchir la page Historique dans le frontend');
    console.log('   2. Vous devriez voir les données de test');
    console.log('   3. Tester le filtre par date');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'insertion :');
    console.error(error.message);
    console.error('\n💡 Vérifiez :');
    console.error('   1. La base de données existe');
    console.error('   2. Les tables sont créées');
    console.error('   3. Les identifiants MySQL sont corrects');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

insertTestData();

