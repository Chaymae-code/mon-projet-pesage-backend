// test-local.js
const { exec } = require('child_process');

console.log('🧪 TESTS LOCAUX DU BACKEND\n');

const tests = [
  {
    name: '1. Test localhost',
    cmd: 'curl -s http://localhost:5000/health'
  },
  {
    name: '2. Test avec IP 10.26.16.110',
    cmd: 'curl -s http://10.26.16.110:5000/health'
  },
  {
    name: '3. Test 127.0.0.1',
    cmd: 'curl -s http://127.0.0.1:5000/health'
  },
  {
    name: '4. Test documentation API',
    cmd: 'curl -s http://localhost:5000/'
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    exec(test.cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${test.name} - ERREUR: ${error.message}`);
        resolve(false);
      } else {
        try {
          const data = JSON.parse(stdout);
          console.log(`✅ ${test.name} - SUCCÈS`);
          if (data.status) console.log(`   📊 Status: ${data.status}`);
          if (data.message) console.log(`   📝 Message: ${data.message.substring(0, 50)}...`);
          resolve(true);
        } catch (e) {
          console.log(`⚠️  ${test.name} - Réponse non JSON: ${stdout.substring(0, 50)}...`);
          resolve(false);
        }
      }
    });
  });
}

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('Démarrage des tests locaux...');
  console.log('='.repeat(50) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const success = await runTest(test);
    if (success) passed++;
    else failed++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSULTATS DES TESTS LOCAUX :');
  console.log(`   ✅ Passés: ${passed}`);
  console.log(`   ❌ Échoués: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 Tous les tests locaux sont réussis !');
    console.log('\n📋 Prochaine étape :');
    console.log('   1. Ton backend est accessible en local');
    console.log('   2. Maintenant, teste depuis un autre appareil');
    console.log('   3. Puis, partage avec ton coéquipier');
  } else {
    console.log('\n🔍 Certains tests ont échoué.');
    console.log('   Vérifie que :');
    console.log('   1. Le serveur tourne (npm run dev)');
    console.log('   2. Le port 5000 n\'est pas bloqué');
    console.log('   3. L\'IP 10.26.16.110 est correcte');
  }
}

runAllTests();