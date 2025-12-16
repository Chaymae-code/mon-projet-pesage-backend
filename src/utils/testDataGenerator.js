// ============================================
// GÉNÉRATEUR DE DONNÉES DE TEST
// ============================================
// Génère des données de pesage réalistes basées sur les fichiers Excel fournis

const { pool } = require('../config/database');

/**
 * Génère des données de test réalistes pour la simulation
 * Basé sur les produits et catégories existants en base
 * @param {number} count - Nombre de pesages à générer
 * @returns {Promise<Array>} Tableau de données de pesage
 */
async function generateTestData(count = 100) {
  try {
    // Récupérer les produits et catégories existants
    const [produits] = await pool.query(`
      SELECT p.id_produit, p.nom_produit, c.nom_categorie, c.id_categorie
      FROM produits p
      LEFT JOIN categories c ON p.id_categorie = c.id_categorie
      ORDER BY RAND()
      LIMIT 50
    `);

    if (produits.length === 0) {
      console.warn('⚠️  Aucun produit trouvé, utilisation de données par défaut');
      return generateDefaultTestData(count);
    }

    // Clients réalistes (basés sur les fichiers Excel réels)
    const clients = [
      'ATM',
      'MCP',
      'DCP',
      'PORT',
      'FERTITECH',
      'MP1',
      'MP2',
      'OCP',
      'MANAJEM',
      'JORF'
    ];

    // Préfixes de matricules réalistes (basés sur les fichiers Excel : 792A81, 4881A50, 2161A74...)
    // Format : chiffres + lettre + chiffres (ex: 792A81, 4881A50)
    const generateMatricule = () => {
      const num1 = Math.floor(Math.random() * 900) + 100; // 100-999
      const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
      const num2 = Math.floor(Math.random() * 100); // 0-99
      return `${num1}${letter}${num2}`;
    };
    
    // Directions possibles
    const directions = ['ENTREE', 'SORTIE'];

    const testData = [];
    const today = new Date();
    const ticketStart = 100000; // Ticket de départ

    for (let i = 0; i < count; i++) {
      // Sélectionner un produit aléatoire
      const produit = produits[Math.floor(Math.random() * produits.length)];
      
      // Générer un matricule réaliste (format: 792A81, 4881A50, etc.)
      const matricule = generateMatricule();

      // Générer des poids réalistes EN TONNES (comme les fichiers Excel)
      // Tare : entre 6 et 18 tonnes (camions vides)
      const tare = parseFloat((6 + Math.random() * 12).toFixed(3));
      
      // Brut : entre 30 et 50 tonnes (camions chargés)
      const brut = parseFloat((tare + 20 + Math.random() * 15).toFixed(3));
      
      // Net calculé (en tonnes)
      const net = parseFloat((brut - tare).toFixed(3));

      // Date : aujourd'hui ou jours précédents (max 7 jours)
      // Format DD/M/YY comme dans les fichiers Excel (12/4/25)
      const daysAgo = Math.floor(Math.random() * 8);
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear().toString().slice(-2);
      const dateStr = `${day}/${month}/${year}`; // Format DD/M/YY

      // Heure réaliste (entre 6h et 22h) - Format HH:MM comme dans Excel
      const hour = Math.floor(Math.random() * 16) + 6;
      const minute = Math.floor(Math.random() * 60);
      const heure = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; // Format HH:MM

      // Client aléatoire (70% de chance d'avoir un client)
      const hasClient = Math.random() > 0.3;
      const client = hasClient ? clients[Math.floor(Math.random() * clients.length)] : null;

      // Direction aléatoire
      const direction = directions[Math.floor(Math.random() * directions.length)];

      // Ticket décroissant (comme dans les fichiers Excel : 58794, 58793, 58791...)
      const ticket = String(ticketStart - i);

      testData.push({
        id_produit: produit.id_produit,
        produit_nom: produit.nom_produit,
        nom_categorie: produit.nom_categorie,
        camion: matricule,
        date_pesage: dateStr,
        heure: heure,
        ticket: ticket,
        tare: tare,
        brut: brut,
        net: net,
        client: client,
        direction: direction
      });
    }

    console.log(`✅ ${testData.length} données de test générées`);
    return testData;

  } catch (error) {
    console.error('❌ Erreur lors de la génération de données de test:', error);
    // Fallback sur données par défaut
    return generateDefaultTestData(count);
  }
}

/**
 * Génère des données par défaut si la base est vide
 */
function generateDefaultTestData(count = 100) {
  // Produits réels trouvés dans les fichiers Excel
  const produits = [
    { id_produit: 1, nom_produit: 'TSP', nom_categorie: 'Vente local' },
    { id_produit: 2, nom_produit: 'Carbonate de Calcium', nom_categorie: 'Produits divers' },
    { id_produit: 3, nom_produit: 'MCP VRAC', nom_categorie: 'Débardage Port ---> Usine' },
    { id_produit: 4, nom_produit: 'Déchet Phosphogypse', nom_categorie: 'Déchets' },
    { id_produit: 5, nom_produit: 'Déchet Soufre', nom_categorie: 'Déchets' },
    { id_produit: 6, nom_produit: 'MCP-BB', nom_categorie: 'Vente export' },
    { id_produit: 7, nom_produit: 'DCP-BB', nom_categorie: 'Vente local' },
    { id_produit: 8, nom_produit: 'ACP', nom_categorie: 'Débardage Port ---> Usine' }
  ];

    const clients = ['ATM', 'MCP', 'DCP', 'PORT', 'FERTITECH', 'MP1', 'MP2'];
  const generateMatricule = () => {
    const num1 = Math.floor(Math.random() * 900) + 100;
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const num2 = Math.floor(Math.random() * 100);
    return `${num1}${letter}${num2}`;
  };
  const directions = ['ENTREE', 'SORTIE'];
  const ticketStart = 100000;

  const testData = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const produit = produits[Math.floor(Math.random() * produits.length)];
    const matricule = generateMatricule();

    // Poids en TONNES (comme les fichiers Excel)
    const tare = parseFloat((6 + Math.random() * 12).toFixed(3));
    const brut = parseFloat((tare + 20 + Math.random() * 15).toFixed(3));
    const net = parseFloat((brut - tare).toFixed(3));

    const daysAgo = Math.floor(Math.random() * 8);
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    const dateStr = `${day}/${month}/${year}`; // Format DD/M/YY

    const hour = Math.floor(Math.random() * 16) + 6;
    const minute = Math.floor(Math.random() * 60);
    const heure = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; // Format HH:MM

    const hasClient = Math.random() > 0.3;
    const client = hasClient ? clients[Math.floor(Math.random() * clients.length)] : null;
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const ticket = String(ticketStart - i);

    testData.push({
      id_produit: produit.id_produit,
      produit_nom: produit.nom_produit,
      nom_categorie: produit.nom_categorie,
      camion: matricule,
      date_pesage: dateStr,
      heure: heure,
      ticket: ticket,
      tare: tare,
      brut: brut,
      net: net,
      client: client,
      direction: direction
    });
  }

  return testData;
}

module.exports = {
  generateTestData,
  generateDefaultTestData
};

