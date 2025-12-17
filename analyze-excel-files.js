/**
 * Script pour analyser les fichiers Excel réels
 * et comprendre la structure des données
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const excelFiles = [
  path.join(__dirname, '..', 'Pesée liste', 'PESEE LISTE .xlsx'),
  path.join(__dirname, '..', 'Pesée liste', 'TABLEAU.xls')
];

function analyzeExcelFile(filePath) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Analyse de: ${path.basename(filePath)}`);
  console.log('='.repeat(80));
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Fichier non trouvé: ${filePath}`);
    return null;
  }
  
  try {
    // Lire le fichier Excel
    const workbook = XLSX.readFile(filePath, { 
      type: 'file',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    console.log(`\n📋 Feuilles disponibles: ${workbook.SheetNames.join(', ')}`);
    
    // Analyser chaque feuille
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n${'-'.repeat(80)}`);
      console.log(`📄 Feuille ${index + 1}: "${sheetName}"`);
      console.log('-'.repeat(80));
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir en JSON pour analyse
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false,
        header: 1 // Garder les en-têtes comme première ligne
      });
      
      if (jsonData.length === 0) {
        console.log('⚠️  Feuille vide');
        return;
      }
      
      // Afficher les premières lignes (en-têtes + quelques données)
      console.log(`\n📊 Nombre de lignes: ${jsonData.length}`);
      console.log(`\n🔍 Premières lignes (en-têtes + 10 lignes de données):`);
      console.log('-'.repeat(80));
      
      const linesToShow = Math.min(11, jsonData.length);
      for (let i = 0; i < linesToShow; i++) {
        const row = jsonData[i];
        if (row && row.length > 0) {
          console.log(`Ligne ${i + 1}:`, JSON.stringify(row, null, 2));
        }
      }
      
      // Analyser les colonnes (en-têtes)
      if (jsonData.length > 0) {
        const headers = jsonData[0];
        console.log(`\n📋 Colonnes détectées (${headers.length} colonnes):`);
        headers.forEach((header, idx) => {
          if (header) {
            console.log(`  ${idx + 1}. "${header}"`);
          }
        });
      }
      
      // Analyser les types de données
      if (jsonData.length > 1) {
        console.log(`\n🔍 Analyse des types de données (échantillon de 5 lignes):`);
        const sampleRows = jsonData.slice(1, Math.min(6, jsonData.length));
        
        sampleRows.forEach((row, rowIdx) => {
          console.log(`\n  Ligne ${rowIdx + 2}:`);
          row.forEach((cell, colIdx) => {
            if (cell !== null && cell !== undefined && cell !== '') {
              const type = typeof cell;
              const preview = String(cell).substring(0, 50);
              console.log(`    Col ${colIdx + 1}: [${type}] ${preview}${String(cell).length > 50 ? '...' : ''}`);
            }
          });
        });
      }
      
      // Convertir avec en-têtes nommés pour une meilleure analyse
      const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false
      });
      
      if (jsonWithHeaders.length > 0) {
        console.log(`\n📊 Structure des données (première ligne avec en-têtes):`);
        console.log(JSON.stringify(jsonWithHeaders[0], null, 2));
        
        // Analyser les clés uniques
        const allKeys = new Set();
        jsonWithHeaders.forEach(row => {
          Object.keys(row).forEach(key => allKeys.add(key));
        });
        
        console.log(`\n🔑 Toutes les clés uniques trouvées (${allKeys.size}):`);
        Array.from(allKeys).sort().forEach(key => {
          console.log(`  - "${key}"`);
        });
      }
    });
    
    return workbook;
    
  } catch (error) {
    console.error(`❌ Erreur lors de l'analyse:`, error.message);
    return null;
  }
}

// Analyser tous les fichiers
console.log('🔍 ANALYSE DES FICHIERS EXCEL RÉELS');
console.log('='.repeat(80));

excelFiles.forEach(filePath => {
  analyzeExcelFile(filePath);
});

console.log(`\n${'='.repeat(80)}`);
console.log('✅ Analyse terminée');
console.log('='.repeat(80));




