/**
 * Test direct du chargement CSV
 */

const path = require('path');
const fs = require('fs');
const { parseCsvFile } = require('./src/utils/csvParser');

// Essayer plusieurs chemins possibles
const possiblePaths = [
  path.join(__dirname, '..', 'peseeliste.csv'),
  path.join(__dirname, '..', 'Pesée liste', 'peseeliste.csv'),
  path.join(__dirname, '..', 'Pesée liste', 'PESEE LISTE .xlsx')
];

console.log('🔍 Recherche du fichier CSV...\n');

for (const csvPath of possiblePaths) {
  console.log(`📂 Test: ${csvPath}`);
  console.log(`   Existe: ${fs.existsSync(csvPath)}`);
  
  if (fs.existsSync(csvPath)) {
    console.log(`\n✅ Fichier trouvé: ${csvPath}\n`);
    
    try {
      if (csvPath.endsWith('.csv')) {
        const csvData = parseCsvFile(csvPath);
        console.log(`\n✅ ${csvData.length} pesages extraits du CSV`);
        if (csvData.length > 0) {
          console.log('\n📋 Exemple (première ligne):');
          console.log(JSON.stringify(csvData[0], null, 2));
        }
      } else {
        console.log('⚠️  Fichier Excel détecté, pas CSV');
      }
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
    break;
  }
}


