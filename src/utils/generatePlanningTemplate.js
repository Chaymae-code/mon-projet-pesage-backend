// ============================================
// GÉNÉRATEUR DE MODÈLE EXCEL POUR PLANIFICATION
// ============================================
// Génère un fichier Excel modèle pour l'import de planification

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function generatePlanningTemplate() {
  // Créer un workbook
  const wb = XLSX.utils.book_new();
  
  // Données d'exemple basées sur le format réel
  const data = [
    // En-têtes (sans Heure - sera automatique)
    ['Matricule', 'Chauffeur', 'Client', 'Produit', 'Type Opération', 'Quantité (t)'],
    // Exemples de données
    ['792A81', 'Ahmed Benali', 'ATM', 'TSP', 'Chargement', '30.000'],
    ['4881A50', 'Fatima Alaoui', 'OCP', 'Carbonate de Calcium', 'Déchargement', '50.000'],
    ['2161A74', 'Mohamed Amrani', 'MCP', 'MCP VRAC', 'Chargement', '25.000'],
    ['2134A74', 'Hassan Idrissi', 'DCP', 'DCP-BB', 'Déchargement', '40.000'],
    ['44932A54', 'Aicha Bensaid', 'PORT', 'MCP VRAC', 'Chargement', '35.000']
  ];
  
  // Créer la feuille
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Définir la largeur des colonnes
  ws['!cols'] = [
    { wch: 12 }, // Matricule
    { wch: 20 }, // Chauffeur
    { wch: 15 }, // Client
    { wch: 25 }, // Produit
    { wch: 18 }, // Type Opération
    { wch: 15 }  // Quantité
  ];
  
  // Style de l'en-tête (première ligne)
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '4472C4' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  
  // Appliquer le style à l'en-tête
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = headerStyle;
  }
  
  // Ajouter la feuille au workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Planification');
  
  // Créer le dossier uploads s'il n'existe pas
  const uploadsDir = path.join(__dirname, '../../uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`📁 Dossier créé: ${uploadsDir}`);
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la création du dossier: ${error.message}`);
    throw error;
  }
  
  // Chemin du fichier modèle
  const templatePath = path.join(uploadsDir, 'modele_planification.xlsx');
  
  try {
    // Écrire le fichier
    XLSX.writeFile(wb, templatePath);
    console.log(`✅ Modèle Excel créé: ${templatePath}`);
    
    // Vérifier que le fichier existe bien
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Le fichier n'a pas été créé: ${templatePath}`);
    }
    
    // Vérifier la taille du fichier
    const stats = fs.statSync(templatePath);
    console.log(`📊 Taille du fichier: ${stats.size} bytes`);
    
    return templatePath;
  } catch (error) {
    console.error(`❌ Erreur lors de l'écriture du fichier: ${error.message}`);
    throw error;
  }
}

// Si exécuté directement
if (require.main === module) {
  generatePlanningTemplate();
}

module.exports = { generatePlanningTemplate };

