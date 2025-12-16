// ============================================
// UTILITAIRE : PARSER EXCEL
// ============================================
// Parse les fichiers Excel pour extraire les données de pesage
// Gère les séparateurs mixtes (point/virgule) et les colonnes flexibles

const XLSX = require('xlsx');

/**
 * Normalise un nombre (gère point et virgule comme séparateur décimal)
 * @param {*} value - Valeur à normaliser
 * @returns {number|null} Nombre normalisé ou null
 */
function normaliserNombre(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Si c'est déjà un nombre
  if (typeof value === 'number') {
    return value;
  }
  
  // Si c'est une string
  if (typeof value === 'string') {
    // Remplacer la virgule par un point
    const normalized = value.trim().replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

/**
 * Parse un fichier Excel et extrait les données de pesage
 * @param {Buffer} fileBuffer - Buffer du fichier Excel
 * @param {Object} options - Options de parsing
 * @returns {Array} Tableau de données de pesage
 */
function parseExcelFile(fileBuffer, options = {}) {
  try {
    // Lire le fichier Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Obtenir le nom de la première feuille
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convertir en JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: null, // Valeurs par défaut null
      raw: false // Convertir les dates en strings
    });

    console.log(`📊 ${jsonData.length} lignes trouvées dans le fichier Excel`);

    // Afficher les colonnes détectées (première ligne)
    if (jsonData.length > 0) {
      console.log('📋 Colonnes détectées dans le fichier Excel:');
      console.log(Object.keys(jsonData[0]).join(', '));
      console.log('📋 Exemple de première ligne brute:');
      console.log(JSON.stringify(jsonData[0], null, 2));
    }

    // Mapper les données selon différents formats possibles
    const pesagesData = jsonData.map((row, index) => {
      return mapExcelRowToPesage(row, index);
    }).filter(pesage => pesage !== null); // Filtrer les lignes invalides

    console.log(`✅ ${pesagesData.length} pesages valides extraits`);

    // Afficher un exemple de pesage mappé
    if (pesagesData.length > 0) {
      console.log('📋 Exemple de pesage mappé (première ligne):');
      console.log(JSON.stringify(pesagesData[0], null, 2));
    }

    return pesagesData;
  } catch (error) {
    console.error('❌ Erreur lors du parsing Excel:', error);
    throw new Error(`Erreur lors du parsing du fichier Excel: ${error.message}`);
  }
}

/**
 * Mappe une ligne Excel vers un objet pesage
 * Supporte différents formats de colonnes
 */
function mapExcelRowToPesage(row, index) {
  // Normaliser les clés (supprimer espaces, mettre en minuscules)
  const normalizedRow = {};
  Object.keys(row).forEach(key => {
    const normalizedKey = key.trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    normalizedRow[normalizedKey] = row[key];
  });

  // Essayer différents formats de colonnes
  const pesage = {
    id_produit: null,
    date_pesage: null,
    camion: null,
    heure: null,
    ticket: null,
    tare: null,
    brut: null,
    net: null,
    client: null,
    produit_nom: null
  };

  // Mapping EXACT des colonnes du fichier Excel PESEE LISTE.xlsx
  // Colonnes : DATE, MATRICULE, HEURE, TICKET, CLIENT, PRODUIT, BRUT, TARE, NET
  
  // DATE (colonne exacte)
  pesage.date_pesage = normalizedRow.date ||
                       normalizedRow.date_pesage ||
                       normalizedRow.date_pesee ||
                       null;

  // MATRICULE (colonne exacte)
  pesage.camion = normalizedRow.matricule ||
                   normalizedRow.camion ||
                   normalizedRow.vehicule ||
                   normalizedRow.vehicle ||
                   normalizedRow.truck ||
                   null;

  // HEURE (colonne exacte)
  pesage.heure = normalizedRow.heure ||
                 normalizedRow.time ||
                 normalizedRow.hour ||
                 null;

  // TICKET (colonne exacte)
  pesage.ticket = normalizedRow.ticket ||
                 normalizedRow.numero_ticket ||
                 normalizedRow.ticket_number ||
                 normalizedRow.num_ticket ||
                 null;

  // CLIENT (colonne exacte)
  pesage.client = normalizedRow.client ||
                  normalizedRow.cliente ||
                  null;

  // PRODUIT (colonne exacte)
  pesage.produit_nom = normalizedRow.produit ||
                       normalizedRow.product ||
                       null;
  
  // ID Produit (rechercher dans la base par nom)
  pesage.id_produit = normalizedRow.produit_id || 
                      normalizedRow.id_produit || 
                      1; // Par défaut

  // BRUT (colonne exacte du fichier Excel PESEE LISTE.xlsx)
  const brutRaw = normalizedRow.brut ||
                  normalizedRow.poids_charge ||
                  normalizedRow.poids_brut ||
                  normalizedRow.gross_weight ||
                  normalizedRow.loaded_weight ||
                  null;
  pesage.brut = normaliserNombre(brutRaw);

  // TARE (colonne exacte du fichier Excel PESEE LISTE.xlsx)
  const tareRaw = normalizedRow.tare ||
                  normalizedRow.poids_vide ||
                  normalizedRow.empty_weight ||
                  normalizedRow.tare_weight ||
                  null;
  pesage.tare = normaliserNombre(tareRaw);

  // NET (colonne exacte du fichier Excel PESEE LISTE.xlsx)
  const netRaw = normalizedRow.net ||
                 normalizedRow.poids_net ||
                 normalizedRow.net_weight ||
                 null;
  pesage.net = normaliserNombre(netRaw);
  
  // Si NET n'est pas fourni, le calculer
  if (!pesage.net && pesage.brut && pesage.tare) {
    pesage.net = pesage.brut - pesage.tare;
  }

  // Valider que les données essentielles sont présentes
  if (!pesage.camion && !pesage.tare && !pesage.brut) {
    // Ligne probablement vide ou en-tête
    return null;
  }

  // Convertir les dates Excel en format YYYY-MM-DD
  if (pesage.date_pesage) {
    pesage.date_pesage = convertExcelDate(pesage.date_pesage);
  }

  // Convertir les heures en format HH:MM:SS
  if (pesage.heure) {
    pesage.heure = convertExcelTime(pesage.heure);
  }

  return pesage;
}

/**
 * Convertit une date Excel en format YYYY-MM-DD
 * Supporte les formats : DD/M/YY, DD/MM/YYYY, YYYY-MM-DD
 */
function convertExcelDate(dateValue) {
  if (!dateValue) return null;

  // Si c'est déjà une string au format date
  if (typeof dateValue === 'string') {
    // Format DD/M/YY (comme dans les fichiers Excel réels : 12/4/25)
    const ddmmyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1]);
      const month = parseInt(ddmmyy[2]);
      const year = parseInt(ddmmyy[3]);
      // Interpréter l'année (si < 50, c'est 20XX, sinon 19XX)
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Format DD/MM/YYYY
    const ddmmyyyy = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }
    
    // Format YYYY-MM-DD
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateValue;
    }
    
    // Essayer de parser avec Date (fallback)
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Si c'est un nombre (date Excel)
  if (typeof dateValue === 'number') {
    // Les dates Excel sont des nombres de jours depuis 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Convertit une heure Excel en format HH:MM:SS
 * Supporte HH:MM (comme dans les fichiers Excel réels) et HH:MM:SS
 */
function convertExcelTime(timeValue) {
  if (!timeValue) return null;

  // Si c'est déjà une string au format heure
  if (typeof timeValue === 'string') {
    // Format HH:MM (comme dans les fichiers Excel réels : 15:47)
    const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = String(timeMatch[1]).padStart(2, '0');
      const minutes = String(timeMatch[2]).padStart(2, '0');
      const seconds = timeMatch[3] || '00';
      return `${hours}:${minutes}:${seconds}`;
    }
  }

  // Si c'est un nombre (fraction de jour Excel)
  if (typeof timeValue === 'number') {
    const totalSeconds = Math.floor(timeValue * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return null;
}

module.exports = {
  parseExcelFile,
  mapExcelRowToPesage,
  normaliserNombre
};

