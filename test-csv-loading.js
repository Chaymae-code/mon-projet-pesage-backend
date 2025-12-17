/**
 * Script de test pour vérifier le chargement du fichier CSV
 */

const path = require('path');
const fs = require('fs');
const { parseCsvFile } = require('./src/utils/csvParser');

const csvPath = path.join(__dirname, '..', 'peseeliste.csv');

console.log('🔍 TEST DE CHARGEMENT CSV');
console.log('='.repeat(80));
console.log(`📂 Chemin du fichier: ${csvPath}`);
console.log(`✅ Fichier existe: ${fs.existsSync(csvPath)}`);

if (!fs.existsSync(csvPath)) {
  console.error('❌ Fichier CSV non trouvé !');
  console.error('❌ Le fichier doit être à: mon-projet-pesage/peseeliste.csv');
  process.exit(1);
}

try {
  console.log('\n📖 Lecture du fichier CSV...');
  const csvData = parseCsvFile(csvPath);

  console.log(`\n✅ ${csvData.length} pesages extraits\n`);

  if (csvData.length > 0) {
    console.log('📋 Première ligne (exemple):');
    console.log(JSON.stringify(csvData[0], null, 2));
    
    if (csvData.length > 1) {
      console.log('\n📋 Deuxième ligne (exemple):');
      console.log(JSON.stringify(csvData[1], null, 2));
    }

    console.log('\n📊 Résumé des colonnes trouvées:');
    const firstRow = csvData[0];
    Object.keys(firstRow).forEach(key => {
      console.log(`  - ${key}: ${firstRow[key]} (type: ${typeof firstRow[key]})`);
    });
  } else {
    console.error('❌ Aucune donnée extraite du fichier CSV !');
  }

} catch (error) {
  console.error('❌ Erreur:', error.message);
  console.error(error.stack);
  process.exit(1);
}




