/**
 * Script pour exécuter la migration SQL
 * Usage: node run-migration.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/database');

async function runMigration() {
  console.log('🔄 Exécution de la migration...\n');
  
  try {
    const migrationPath = path.join(__dirname, 'migrations', '001_enrichir_pesages.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Diviser le SQL en instructions individuelles
    // Gérer les instructions préparées (PREPARE/EXECUTE/DEALLOCATE) comme un bloc
    const statements = [];
    let currentStatement = '';
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Ignorer les commentaires
      if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Si la ligne se termine par ';', c'est la fin d'une instruction
      if (trimmed.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Ajouter la dernière instruction si elle n'a pas de ';'
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📝 ${statements.length} instructions SQL à exécuter\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.startsWith('SELECT')) {
        try {
          await pool.query(statement);
          console.log(`✅ Instruction ${i + 1}/${statements.length} exécutée`);
        } catch (error) {
          // Ignorer les erreurs "colonne/index existe déjà"
          if (error.message.includes('Duplicate column name') || 
              error.message.includes('Duplicate key name') ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate index')) {
            console.log(`⚠️  Instruction ${i + 1}: Déjà existant (ignoré)`);
          } else {
            console.error(`❌ Erreur instruction ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Migration terminée avec succès !\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

