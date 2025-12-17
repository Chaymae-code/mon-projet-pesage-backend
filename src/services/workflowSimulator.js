// ============================================
// SERVICE : SIMULATION AUTOMATIQUE DU WORKFLOW
// ============================================
// Surveille les pesages et déclenche automatiquement les pesées
// en utilisant le service Python calculateur

const { operationalPool } = require('../config/operationalDatabase');
const { spawn } = require('child_process');
const { WeighingEvents } = require('../websocket/websocketServer');
const path = require('path');

class WorkflowSimulator {
  constructor() {
    this.activeSimulations = new Map(); // weighing_id -> simulation process
    this.checkInterval = null;
    this.checkIntervalMs = 2000; // Vérifie toutes les 2 secondes
    this.delays = {
      arrivalToEntry: 3000,       // 3 secondes après ARRIVAL → première pesée (temps de positionnement)
      entryToZone: 2000,          // 2 secondes après première pesée → zone (temps de sortie du pont)
      zoneToExit: 5000,           // 5 secondes en zone → deuxième pesée (temps de chargement/déchargement) - réduit pour démo
      exitToComplete: 2000        // 2 secondes après deuxième pesée → complété (temps de finalisation)
    };
    
    // File d'attente pour les pesées (un seul camion sur le pont à la fois)
    this.weighingQueue = [];
    this.currentWeighingOnBridge = null; // ID du pesage actuellement sur le pont
  }

  /**
   * Démarre le service de simulation
   */
  start() {
    console.log('🚀 Démarrage du service de simulation automatique...');
    
    // Vérifier immédiatement les pesages existants
    this.checkForNewWeighings();
    
    // Vérifier périodiquement
    this.checkInterval = setInterval(() => {
      this.checkForNewWeighings();
    }, this.checkIntervalMs);
    
    console.log(`✅ Service de simulation démarré (vérification toutes les ${this.checkIntervalMs}ms)`);
  }

  /**
   * Arrête le service de simulation
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Arrêter toutes les simulations actives
    for (const [weighingId, process] of this.activeSimulations.entries()) {
      if (process && !process.killed) {
        process.kill();
      }
    }
    this.activeSimulations.clear();
    
    // Réinitialiser la file d'attente et le pont
    this.weighingQueue = [];
    this.currentWeighingOnBridge = null;
    
    console.log('🛑 Service de simulation arrêté');
  }

  /**
   * Libère le pont (appelé quand un pesage est annulé ou terminé)
   */
  releaseBridge(weighingId) {
    if (this.currentWeighingOnBridge === weighingId) {
      this.currentWeighingOnBridge = null;
      console.log(`✅ Pont libéré (pesage ${weighingId} terminé/annulé)`);
    }
    
    // Retirer de la file d'attente si présent
    const index = this.weighingQueue.indexOf(weighingId);
    if (index > -1) {
      this.weighingQueue.splice(index, 1);
    }
    
    // Retirer des simulations actives
    this.activeSimulations.delete(weighingId);
  }

  /**
   * Vérifie périodiquement les nouveaux pesages en ARRIVAL
   * Gère la file d'attente pour éviter les chevauchements
   */
  async checkForNewWeighings() {
    try {
      // Vérifier si un pesage est en cours sur le pont
      const [weighingsOnBridge] = await operationalPool.query(
        `SELECT id_weighing FROM active_weighings 
         WHERE current_state IN ('ENTRY_WEIGHING', 'EXIT_WEIGHING') 
         LIMIT 1`
      );

      if (weighingsOnBridge.length > 0) {
        this.currentWeighingOnBridge = weighingsOnBridge[0].id_weighing;
      } else {
        this.currentWeighingOnBridge = null;
      }

      // Récupérer les nouveaux pesages en ARRIVAL
      const [allArrivals] = await operationalPool.query(
        `SELECT id_weighing FROM active_weighings WHERE current_state = 'ARRIVAL'`
      );

      for (const row of allArrivals) {
        if (!this.activeSimulations.has(row.id_weighing)) {
          // Ajouter à la file d'attente au lieu de démarrer directement
          await this.addToQueue(row.id_weighing);
        }
      }

      // Traiter la file d'attente si le pont est libre
      if (this.currentWeighingOnBridge === null && this.weighingQueue.length > 0) {
        const nextWeighingId = this.weighingQueue.shift();
        await this.startSimulation(nextWeighingId);
      }
    } catch (error) {
      console.error('❌ Erreur vérification nouveaux pesages:', error);
    }
  }

  /**
   * Ajoute un pesage à la file d'attente
   */
  async addToQueue(weighingId) {
    if (!this.weighingQueue.includes(weighingId)) {
      this.weighingQueue.push(weighingId);
      console.log(`📋 Pesage ${weighingId} ajouté à la file d'attente (position: ${this.weighingQueue.length})`);
    }
  }

  /**
   * Démarre la simulation complète pour un pesage
   */
  async startSimulation(weighingId) {
    try {
      // Récupérer les détails du pesage
    const [weighings] = await operationalPool.query(
        `SELECT * FROM active_weighings WHERE id_weighing = ? LIMIT 1`,
      [weighingId]
    );

    if (weighings.length === 0) {
        console.warn(`⚠️  Pesage ${weighingId} non trouvé`);
      return;
    }

    const weighing = weighings[0];

    if (weighing.current_state !== 'ARRIVAL') {
        console.warn(`⚠️  Pesage ${weighingId} n'est pas en ARRIVAL (état: ${weighing.current_state})`);
      return;
    }

      // Vérifier que le pont est libre avant de démarrer
      if (this.currentWeighingOnBridge !== null) {
        console.log(`⏳ Pesage ${weighingId} en attente - Pont occupé par ${this.currentWeighingOnBridge}`);
        await this.addToQueue(weighingId);
        return;
      }

      console.log(`🎬 Démarrage simulation pour pesage ${weighingId} (${weighing.matricule})`);
      
      // Marquer le pont comme occupé
      this.currentWeighingOnBridge = weighingId;
      
      // Marquer comme en cours de simulation
      this.activeSimulations.set(weighingId, { status: 'running', startTime: Date.now() });

      // Étape 1 : Attendre puis démarrer la première pesée
      setTimeout(async () => {
        await this.startEntryWeighing(weighingId, weighing);
      }, this.delays.arrivalToEntry);

    } catch (error) {
      console.error(`❌ Erreur démarrage simulation ${weighingId}:`, error);
      this.activeSimulations.delete(weighingId);
    }
  }

  /**
   * Démarre la première pesée (ENTRY_WEIGHING)
   */
  async startEntryWeighing(weighingId, weighing) {
    try {
      console.log(`⚖️  [${weighingId}] Démarrage première pesée...`);

      // Mettre à jour l'état dans la base
      await operationalPool.query(
        `UPDATE active_weighings 
         SET current_state = 'ENTRY_WEIGHING', 
             entry_weighing_time = NOW(),
             updated_at = NOW()
         WHERE id_weighing = ?`,
        [weighingId]
      );

      // Émettre événement WebSocket
      WeighingEvents.weighingStateChanged({
        weighing_id: weighingId,
        old_state: 'ARRIVAL',
        new_state: 'ENTRY_WEIGHING',
        matricule: weighing.matricule
      });

      // Lancer le simulateur Python pour la première pesée
      try {
        await this.runPythonSimulator(weighingId, 'entry', weighing.operation_type);
        
        // Attendre un court délai puis passer à la zone
        setTimeout(async () => {
          await this.startZoneEntry(weighingId, weighing);
        }, 1000);
      } catch (error) {
        console.error(`❌ [${weighingId}] Erreur simulation première pesée:`, error);
        // Continuer quand même après un délai
        setTimeout(async () => {
          await this.startZoneEntry(weighingId, weighing);
        }, this.delays.entryToZone);
      }

      } catch (error) {
      console.error(`❌ Erreur première pesée ${weighingId}:`, error);
    }
  }

  /**
   * Passe à la zone de charge/décharge
   * Libère le pont pour le prochain camion
   */
  async startZoneEntry(weighingId, weighing) {
    try {
      console.log(`🏭 [${weighingId}] Entrée en zone ${weighing.operation_type}...`);

      const newState = weighing.operation_type === 'LOADING' ? 'LOADING' : 'UNLOADING';

      await operationalPool.query(
        `UPDATE active_weighings 
         SET current_state = ?, 
             zone_entry_time = NOW(),
             updated_at = NOW()
         WHERE id_weighing = ?`,
        [newState, weighingId]
      );

      // Libérer le pont (le camion n'est plus sur le pont)
      if (this.currentWeighingOnBridge === weighingId) {
        this.currentWeighingOnBridge = null;
        console.log(`✅ [${weighingId}] Pont libéré - Prêt pour le prochain camion`);
      }

      // Émettre événement WebSocket
      WeighingEvents.weighingStateChanged({
        weighing_id: weighingId,
        old_state: 'ENTRY_WEIGHING',
        new_state: newState,
        matricule: weighing.matricule
      });

      // Attendre puis démarrer la deuxième pesée
      setTimeout(async () => {
        await this.startExitWeighing(weighingId, weighing);
      }, this.delays.zoneToExit);

    } catch (error) {
      console.error(`❌ Erreur entrée zone ${weighingId}:`, error);
    }
  }

  /**
   * Démarre la deuxième pesée (EXIT_WEIGHING)
   * Vérifie que le pont est libre avant de commencer
   */
  async startExitWeighing(weighingId, weighing) {
    try {
      // Vérifier que le pont est libre
      if (this.currentWeighingOnBridge !== null && this.currentWeighingOnBridge !== weighingId) {
        console.log(`⏳ [${weighingId}] Pont occupé, attente pour deuxième pesée...`);
        // Réessayer dans 2 secondes
        setTimeout(() => {
          this.startExitWeighing(weighingId, weighing);
        }, 2000);
        return;
      }

      console.log(`⚖️  [${weighingId}] Démarrage deuxième pesée...`);

      // Récupérer le poids d'entrée
      const [weighings] = await operationalPool.query(
        `SELECT entry_weight FROM active_weighings WHERE id_weighing = ? LIMIT 1`,
        [weighingId]
      );

      if (weighings.length === 0 || !weighings[0].entry_weight) {
        console.warn(`⚠️  [${weighingId}] Poids d'entrée non disponible`);
        return;
      }

      const entryWeight = parseFloat(weighings[0].entry_weight);

      // Marquer le pont comme occupé
      this.currentWeighingOnBridge = weighingId;

      await operationalPool.query(
        `UPDATE active_weighings 
         SET current_state = 'EXIT_WEIGHING', 
             exit_weighing_time = NOW(),
             updated_at = NOW()
         WHERE id_weighing = ?`,
        [weighingId]
      );

      // Émettre événement WebSocket
      WeighingEvents.weighingStateChanged({
        weighing_id: weighingId,
        old_state: weighing.operation_type,
        new_state: 'EXIT_WEIGHING',
        matricule: weighing.matricule
      });

      // Lancer le simulateur Python pour la deuxième pesée
      try {
        await this.runPythonSimulator(weighingId, 'exit', weighing.operation_type, entryWeight);
        
        // Attendre un court délai puis finaliser
        setTimeout(async () => {
          await this.completeWeighing(weighingId, weighing);
        }, 1000);
      } catch (error) {
        console.error(`❌ [${weighingId}] Erreur simulation deuxième pesée:`, error);
        // Continuer quand même après un délai
        setTimeout(async () => {
          await this.completeWeighing(weighingId, weighing);
        }, this.delays.exitToComplete);
      }

    } catch (error) {
      console.error(`❌ Erreur deuxième pesée ${weighingId}:`, error);
    }
  }

  /**
   * Finalise le pesage (COMPLETED)
   * Libère le pont pour le prochain camion
   */
  async completeWeighing(weighingId, weighing) {
    try {
      console.log(`✅ [${weighingId}] Finalisation du pesage...`);

      // Récupérer les poids finaux
      const [weighings] = await operationalPool.query(
        `SELECT entry_weight, exit_weight, tare, brut, net FROM active_weighings WHERE id_weighing = ? LIMIT 1`,
        [weighingId]
      );

      if (weighings.length === 0) {
        console.warn(`⚠️  [${weighingId}] Pesage non trouvé pour finalisation`);
        return;
      }

      const finalWeighing = weighings[0];

      if (!finalWeighing.entry_weight || !finalWeighing.exit_weight) {
        console.warn(`⚠️  [${weighingId}] Poids incomplets pour finalisation`);
        return;
      }

      // Générer le numéro de ticket séquentiel
      const { generateNextTicketNumber } = require('../utils/ticketGenerator');
      const ticketNumber = await generateNextTicketNumber();

      await operationalPool.query(
        `UPDATE active_weighings 
         SET current_state = 'COMPLETED', 
             completion_time = NOW(),
             ticket_number = ?,
             updated_at = NOW()
         WHERE id_weighing = ?`,
        [ticketNumber, weighingId]
      );

      // Libérer le pont
      if (this.currentWeighingOnBridge === weighingId) {
        this.currentWeighingOnBridge = null;
        console.log(`✅ [${weighingId}] Pont libéré après finalisation`);
      }

      // Mettre à jour le statut de la planification
      if (weighing.id_planning) {
        await operationalPool.query(
          `UPDATE daily_planning SET status = 'COMPLETED' WHERE id_planning = ?`,
          [weighing.id_planning]
        );
      }

      // Émettre événement WebSocket
      WeighingEvents.weighingCompleted({
        weighing_id: weighingId,
        matricule: weighing.matricule,
        ticket_number: ticketNumber,
        net_weight: finalWeighing.net,
        client_name: weighing.client_name
      });

      console.log(`✅ [${weighingId}] Pesage complété - Ticket: ${ticketNumber}, Net: ${finalWeighing.net}t`);

      // Nettoyer la simulation et libérer le pont
      this.releaseBridge(weighingId);

    } catch (error) {
      console.error(`❌ Erreur finalisation ${weighingId}:`, error);
    }
  }

  /**
   * Lance le simulateur Python pour une pesée
   * Si Python n'est pas disponible, simule directement via l'API
   */
  async runPythonSimulator(weighingId, type, operationType, entryWeight = null) {
    return new Promise(async (resolve, reject) => {
      const calculatorPath = path.join(__dirname, '../../../calculator_service/calculator_simulator.py');
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

      const args = [
        calculatorPath,
        '--weighing-id', weighingId.toString(),
        '--type', type,
        '--operation', operationType,
        '--backend', backendUrl
      ];

      if (type === 'exit' && entryWeight) {
        args.push('--entry-weight', entryWeight.toString());
      }

      console.log(`🐍 [${weighingId}] Tentative lancement simulateur Python...`);

      const pythonProcess = spawn('python', args, {
        cwd: path.join(__dirname, '../../../'),
        stdio: 'pipe'
      });

      // Stocker le processus
      const sim = this.activeSimulations.get(weighingId);
      if (sim) {
        sim.pythonProcess = pythonProcess;
      }

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`🐍 [${weighingId}] ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(`🐍 [${weighingId}] ERREUR: ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ [${weighingId}] Simulateur Python terminé avec succès`);
          resolve();
        } else {
          console.warn(`⚠️  [${weighingId}] Simulateur Python échoué (code ${code}), utilisation simulation directe`);
          // Fallback: simuler directement
          this.simulateWeightDirectly(weighingId, type, operationType, entryWeight)
            .then(() => resolve())
            .catch(err => reject(err));
        }
      });

      pythonProcess.on('error', (error) => {
        console.warn(`⚠️  [${weighingId}] Python non disponible (${error.message}), utilisation simulation directe`);
        // Fallback: simuler directement
        this.simulateWeightDirectly(weighingId, type, operationType, entryWeight)
          .then(() => resolve())
          .catch(err => reject(err));
      });
    });
  }

  /**
   * Simule directement les poids via l'API (fallback si Python indisponible)
   */
  async simulateWeightDirectly(weighingId, type, operationType, entryWeight = null) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    let targetWeight;
    
    if (type === 'entry') {
      // Première pesée
      if (operationType === 'LOADING') {
        targetWeight = 6.0 + Math.random() * 12.0; // 6-18 tonnes (TARE)
      } else {
        targetWeight = 30.0 + Math.random() * 20.0; // 30-50 tonnes (BRUT)
      }
    } else {
      // Deuxième pesée
      if (operationType === 'LOADING') {
        const net = 20.0 + Math.random() * 15.0; // 20-35 tonnes
        targetWeight = entryWeight + net; // BRUT = TARE + NET
      } else {
        const net = 20.0 + Math.random() * 15.0; // 20-35 tonnes
        targetWeight = entryWeight - net; // TARE = BRUT - NET
      }
    }

    console.log(`⚖️  [${weighingId}] Simulation directe: ${targetWeight.toFixed(3)}t`);

    // Simuler progression progressive
    const steps = 10;
    const stepSize = targetWeight / steps;
    let currentWeight = 0;

    for (let i = 0; i < steps; i++) {
      currentWeight += stepSize;
      const weight = Math.min(currentWeight, targetWeight);
      const stability = i === steps - 1 ? 'STABLE' : 'UNSTABLE';

      try {
        const response = await fetch(
          `${backendUrl}/api/weighings/${weighingId}/weight-update`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              weight: parseFloat(weight.toFixed(3)),
              stability: stability,
              timestamp: new Date().toISOString()
            }),
            signal: AbortSignal.timeout(5000)
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
        console.error(`❌ [${weighingId}] Erreur envoi poids:`, error.message);
      }

      // Délai entre chaque étape
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`✅ [${weighingId}] Simulation directe terminée: ${targetWeight.toFixed(3)}t`);
  }
}

// Instance singleton
let simulatorInstance = null;

/**
 * Initialise et démarre le service de simulation
 */
function startWorkflowSimulator() {
  if (!simulatorInstance) {
    simulatorInstance = new WorkflowSimulator();
    simulatorInstance.start();
  }
  return simulatorInstance;
}

/**
 * Arrête le service de simulation
 */
function stopWorkflowSimulator() {
  if (simulatorInstance) {
    simulatorInstance.stop();
    simulatorInstance = null;
  }
}

module.exports = {
  startWorkflowSimulator,
  stopWorkflowSimulator,
  getSimulator: () => simulatorInstance
};
