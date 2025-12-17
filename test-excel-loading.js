/**
 * Script de diagnostic pour tester le chargement du fichier Excel
 */

const path = require('path');
const fs = require('fs');
const { parseExcelFile } = require('./src/utils/excelParser');

const excelPath = path.join(__dirname, '..', 'Pesée liste', 'PESEE LISTE .xlsx');

console.log('🔍 DIAGNOSTIC DU CHARGEMENT EXCEL');
console.log('='.repeat(80));
console.log(`📂 Chemin du fichier: ${excelPath}`);
console.log(`✅ Fichier existe: ${fs.existsSync(excelPath)}`);

if (!fs.existsSync(excelPath)) {
  console.error('❌ Fichier Excel non trouvé !');
  process.exit(1);
}

try {
  console.log('\n📖 Lecture du fichier...');
  const fileBuffer = fs.readFileSync(excelPath);
  console.log(`✅ Fichier lu: ${fileBuffer.length} octets`);

  console.log('\n📊 Parsing du fichier Excel...');
  const excelData = parseExcelFile(fileBuffer);

  console.log(`\n✅ ${excelData.length} pesages extraits\n`);

  if (excelData.length > 0) {
    console.log('📋 Première ligne (exemple):');
    console.log(JSON.stringify(excelData[0], null, 2));
    
    console.log('\n📋 Deuxième ligne (exemple):');
    if (excelData.length > 1) {
      console.log(JSON.stringify(excelData[1], null, 2));
    }

    console.log('\n📊 Résumé des colonnes trouvées:');
    const firstRow = excelData[0];
    Object.keys(firstRow).forEach(key => {
      console.log(`  - ${key}: ${firstRow[key]} (type: ${typeof firstRow[key]})`);
    });
  } else {
    console.error('❌ Aucune donnée extraite du fichier Excel !');
  }

} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.error(error.stack);
  process.exit(1);
}


