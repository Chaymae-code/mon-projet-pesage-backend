/**
 * Charge les données réelles du fichier Excel PESEE LISTE.xlsx
 * pour les utiliser dans la simulation
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelFile = path.join(__dirname, '..', 'Pesée liste', 'PESEE LISTE .xlsx');

function loadExcelData() {
  console.log(`📂 Chargement du fichier: ${path.basename(excelFile)}`);
  
  if (!fs.existsSync(excelFile)) {
    console.error(`❌ Fichier non trouvé: ${excelFile}`);
    return null;
  }
  
  try {
    const workbook = XLSX.readFile(excelFile, { 
      type: 'file',
      cellDates: true
    });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convertir en JSON avec en-têtes
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false
    });
    
    console.log(`✅ ${jsonData.length} lignes chargées`);
    
    // Afficher les premières lignes pour vérification
    if (jsonData.length > 0) {
      console.log('\n📋 Première ligne (exemple):');
      console.log(JSON.stringify(jsonData[0], null, 2));
    }
    
    return jsonData;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return null;
  }
}

// Exporter pour utilisation
if (require.main === module) {
  const data = loadExcelData();
  if (data) {
    console.log(`\n✅ ${data.length} pesages chargés`);
  }
}

module.exports = { loadExcelData };


