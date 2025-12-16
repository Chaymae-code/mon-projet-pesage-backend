/**
 * Parser CSV pour les fichiers de pesage
 * Supporte les fichiers CSV avec séparateur virgule ou point-virgule
 */

const fs = require('fs');

/**
 * Normalise un nombre (gère point et virgule comme séparateur décimal)
 */
function normaliserNombre(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Nettoyer : supprimer les espaces et guillemets, remplacer virgule par point
    let cleaned = value.trim().replace(/^"|"$/g, '').trim();
    // Remplacer TOUTES les virgules par des points (pour le séparateur décimal)
    cleaned = cleaned.replace(/,/g, '.');
    const num = parseFloat(cleaned);
    // Garder la précision (arrondir à 3 décimales max pour les tonnes)
    return isNaN(num) ? null : parseFloat(num.toFixed(3));
  }
  
  return null;
}

/**
 * Convertit une date CSV en format YYYY-MM-DD
 * Supporte : DD/M/YY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
 */
function convertCsvDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    
    // Format MM/DD/YYYY (format américain - priorité car c'est le format du CSV)
    const mmddyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const [_, month, day, year] = mmddyyyy;
      // Vérifier si c'est vraiment MM/DD/YYYY (premier nombre <= 12)
      if (parseInt(month) <= 12 && parseInt(day) <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Format DD/M/YY (e.g., 12/4/25)
    const ddmmyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (ddmmyy) {
      let [_, day, month, year] = ddmmyy;
      year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    // Format DD/MM/YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [_, day, month, year] = ddmmyyyy;
      // Si le premier nombre > 12, c'est DD/MM/YYYY
      if (parseInt(day) > 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
    
    // Format YYYY-MM-DD
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Convertit une heure CSV en format HH:MM:SS
 */
function convertCsvTime(timeValue) {
  if (!timeValue) return null;

  if (typeof timeValue === 'string') {
    const trimmed = timeValue.trim();
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const hours = String(timeMatch[1]).padStart(2, '0');
      const minutes = String(timeMatch[2]).padStart(2, '0');
      const seconds = timeMatch[3] || '00';
      return `${hours}:${minutes}:${seconds}`;
    }
  }

  return null;
}

/**
 * Parse un fichier CSV et extrait les données de pesage
 */
function parseCsvFile(filePath) {
  try {
    console.log(`📂 Lecture du fichier CSV: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier CSV non trouvé: ${filePath}`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Fichier CSV vide');
    }
    
    console.log(`📊 ${lines.length} lignes trouvées dans le fichier CSV`);
    
    // Détecter le séparateur (virgule ou point-virgule)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    console.log(`🔍 Séparateur détecté: "${separator}"`);
    
    // Extraire les en-têtes
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    console.log(`📋 Colonnes détectées (${headers.length}): ${headers.join(', ')}`);
    
    // Parser les lignes de données
    const pesagesData = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Séparer en tenant compte des guillemets
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Dernière valeur
      
      // Nettoyer les guillemets
      const cleanedValues = values.map(v => v.replace(/^"|"$/g, '').trim());
      
      // Ajuster si on a moins de valeurs que d'en-têtes
      while (cleanedValues.length < headers.length) {
        cleanedValues.push('');
      }
      
      if (cleanedValues.length < headers.length) {
        console.warn(`⚠️  Ligne ${i + 1} ignorée (colonnes manquantes: ${cleanedValues.length}/${headers.length})`);
        continue;
      }
      
      // Créer un objet normalisé
      const normalizedRow = {};
      headers.forEach((header, index) => {
        normalizedRow[header] = cleanedValues[index] || null;
      });
      
      // Mapper vers le format pesage
      const pesage = mapCsvRowToPesage(normalizedRow, i);
      
      if (pesage) {
        pesagesData.push(pesage);
      }
    }
    
    console.log(`✅ ${pesagesData.length} pesages valides extraits`);
    
    if (pesagesData.length > 0) {
      console.log('📋 Exemple de pesage extrait (première ligne):');
      console.log(JSON.stringify(pesagesData[0], null, 2));
    }
    
    return pesagesData;
    
  } catch (error) {
    console.error('❌ Erreur lors du parsing CSV:', error);
    throw new Error(`Erreur lors du parsing du fichier CSV: ${error.message}`);
  }
}

/**
 * Mappe une ligne CSV vers un objet pesage
 */
function mapCsvRowToPesage(normalizedRow, index) {
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

  // DATE (colonne exacte)
  pesage.date_pesage = normalizedRow.date || null;

  // MATRICULE (colonne exacte)
  pesage.camion = normalizedRow.matricule ||
                   normalizedRow.camion ||
                   null;

  // HEURE (colonne exacte)
  pesage.heure = normalizedRow.heure || null;

  // TICKET (colonne exacte)
  pesage.ticket = normalizedRow.ticket || null;

  // CLIENT (colonne exacte)
  pesage.client = normalizedRow.client || null;

  // PRODUIT (colonne exacte)
  pesage.produit_nom = normalizedRow.produit || null;
  pesage.id_produit = normalizedRow.produit_id || 
                      normalizedRow.id_produit || 
                      1;

  // BRUT
  const brutRaw = normalizedRow.brut || null;
  pesage.brut = normaliserNombre(brutRaw);

  // TARE
  const tareRaw = normalizedRow.tare || null;
  pesage.tare = normaliserNombre(tareRaw);

  // NET
  const netRaw = normalizedRow.net || null;
  pesage.net = normaliserNombre(netRaw);
  
  // Si NET n'est pas fourni, le calculer
  if (!pesage.net && pesage.brut && pesage.tare) {
    pesage.net = pesage.brut - pesage.tare;
  }

  // Valider que les données essentielles sont présentes
  if (!pesage.camion && !pesage.tare && !pesage.brut) {
    return null;
  }

  // Convertir les dates
  if (pesage.date_pesage) {
    pesage.date_pesage = convertCsvDate(pesage.date_pesage);
  }

  // Convertir les heures
  if (pesage.heure) {
    pesage.heure = convertCsvTime(pesage.heure);
  }

  return pesage;
}

module.exports = { parseCsvFile };

