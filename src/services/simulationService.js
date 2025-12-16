// ============================================
// SERVICE : SIMULATION DE PESAGE EN TEMPS RÉEL
// ============================================
// Simule des pesages industriels avec logique 1er/2e pesage

const { pool } = require('../config/database');
const SequencePesage = require('../models/SequencePesage');

class SimulationService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.config = null;
    this.pesagesData = []; // Données Excel parsées
    this.currentIndex = 0; // Index dans les données Excel
    this.sequencesEnCours = new Map(); // Map<matricule, SequencePesage>
    this.statistiques = {
      total: 0,
      completes: 0,
      enCours: 0,
      enZone: 0,
      annules: 0
    };
    this.ticketCounter = null; // Compteur de tickets (séquentiel décroissant)
  }

  /**
   * Charge les données depuis un fichier Excel parsé
   * @param {Array} excelData - Données extraites du fichier Excel
   * @param {Object} config - Configuration de la simulation
   */
  loadData(excelData, config = {}) {
    this.pesagesData = excelData;
    this.config = {
      intervalArrivee: config.intervalArrivee || 30000, // 30s entre arrivées
      delaiZoneMin: config.delaiZoneMin || 120, // 2 min minimum
      delaiZoneMax: config.delaiZoneMax || 300, // 5 min maximum
      speed: config.speed || 1, // Vitesse de simulation
      startDate: config.startDate || new Date().toISOString().split('T')[0],
      ...config
    };
    this.currentIndex = 0;
    
    // Initialiser le compteur de tickets (décroissant comme Excel)
    if (excelData.length > 0) {
      // Trouver le ticket le plus élevé dans les données
      const tickets = excelData
        .map(d => d.ticket)
        .filter(t => t && !isNaN(parseInt(t)))
        .map(t => parseInt(t))
        .sort((a, b) => b - a);
      
      this.ticketCounter = tickets.length > 0 ? tickets[0] : 100000;
    } else {
      this.ticketCounter = 100000;
    }
    
    console.log(`📊 ${this.pesagesData.length} pesages chargés pour simulation`);
    console.log(`🎫 Compteur de tickets initialisé à: ${this.ticketCounter}`);
  }

  /**
   * Démarre la simulation
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Simulation déjà en cours');
      return;
    }

    if (this.pesagesData.length === 0) {
      throw new Error('Aucune donnée chargée. Veuillez d\'abord charger un fichier Excel.');
    }

    this.isRunning = true;
    this.currentIndex = 0;
    this.statistiques = {
      total: this.pesagesData.length,
      completes: 0,
      enCours: 0,
      enZone: 0,
      annules: 0
    };
    
    const interval = this.config.intervalArrivee / this.config.speed;
    
    console.log(`🚀 Démarrage de la simulation (intervalle arrivées: ${interval}ms)`);
    
    // Créer la première arrivée immédiatement
    this.creerArriveeCamion().catch(err => console.error('Erreur creerArriveeCamion:', err));
    
    // Puis créer les suivantes à intervalles réguliers
    this.intervalId = setInterval(() => {
      this.creerArriveeCamion().catch(err => console.error('Erreur creerArriveeCamion:', err));
    }, interval);
    
    // Vérifier périodiquement les séquences en cours
    this.checkSequencesInterval = setInterval(() => {
      this.processSequencesEnCours();
    }, 1000); // Toutes les secondes
  }

  /**
   * Arrête la simulation
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.checkSequencesInterval) {
      clearInterval(this.checkSequencesInterval);
      this.checkSequencesInterval = null;
    }
    console.log('⏹️ Simulation arrêtée');
  }

  /**
   * Trouve un produit par nom ou le crée s'il n'existe pas
   */
  async trouverOuCreerProduit(nomProduit) {
    if (!nomProduit) return null;
    
    try {
      // Chercher le produit par nom (insensible à la casse)
      const [produits] = await pool.query(
        'SELECT id_produit FROM produits WHERE LOWER(TRIM(nom_produit)) = LOWER(TRIM(?))',
        [nomProduit]
      );
      
      if (produits.length > 0) {
        console.log(`✅ Produit trouvé: ${nomProduit} (ID: ${produits[0].id_produit})`);
        return produits[0].id_produit;
      }
      
      console.log(`⚠️  Produit "${nomProduit}" non trouvé dans la base, création...`);
      // Produit non trouvé, chercher une catégorie par défaut
      const [categories] = await pool.query('SELECT id_categorie FROM categories LIMIT 1');
      const id_categorie = categories.length > 0 ? categories[0].id_categorie : 1;
      
      // Créer le produit
      const [result] = await pool.query(
        'INSERT INTO produits (nom_produit, id_categorie, nombre_camions, tonnage) VALUES (?, ?, ?, ?)',
        [nomProduit.trim(), id_categorie, 0, 0.0]
      );
      
      console.log(`✅ Produit créé: ${nomProduit} (ID: ${result.insertId})`);
      return result.insertId;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la recherche/création du produit ${nomProduit}:`, error.message);
      return null;
    }
  }

  /**
   * Crée une nouvelle arrivée de camion
   */
  async creerArriveeCamion() {
    if (this.currentIndex >= this.pesagesData.length) {
      console.log('✅ Tous les camions ont été traités');
      this.stop();
      return;
    }

    const dataExcel = this.pesagesData[this.currentIndex];
    this.currentIndex++;

    try {
      // Chercher ou créer le produit par nom (ignorer id_produit du CSV car il est souvent 1)
      let id_produit = null;
      
      console.log(`🔍 Recherche produit pour: "${dataExcel.produit_nom}"`);
      
      if (dataExcel.produit_nom) {
        id_produit = await this.trouverOuCreerProduit(dataExcel.produit_nom);
        console.log(`🔍 Résultat recherche produit: id_produit = ${id_produit}`);
      }
      
      // Si toujours pas de produit, utiliser le premier produit disponible
      if (!id_produit) {
        console.log(`⚠️  Aucun id_produit, recherche du premier produit disponible...`);
        const [produits] = await pool.query('SELECT id_produit FROM produits LIMIT 1');
        id_produit = produits.length > 0 ? produits[0].id_produit : null;
        console.log(`🔍 Premier produit disponible: id_produit = ${id_produit}`);
      }
      
      if (!id_produit) {
        console.error(`❌ Impossible de trouver ou créer un produit pour ${dataExcel.produit_nom}`);
        return;
      }
      
      console.log(`✅ Produit trouvé/créé: id_produit = ${id_produit} pour "${dataExcel.produit_nom}"`);
      
      // Créer une nouvelle séquence
      const sequence = new SequencePesage({
        matricule: dataExcel.camion || `CAM-${Date.now()}`,
        client: dataExcel.client,
        produit: dataExcel.produit_nom,
        id_produit: id_produit,
        date_pesage: dataExcel.date_pesage || this.config.startDate
      });

      // Déterminer la direction (aléatoire ou depuis Excel si disponible)
      const direction = dataExcel.direction || (Math.random() > 0.5 ? 'ENTREE' : 'SORTIE');
      sequence.determineTypeSequence(direction);

      // Générer le ticket
      sequence.genererTicket(this.ticketCounter);
      this.ticketCounter--;

      // Enregistrer la séquence
      this.sequencesEnCours.set(sequence.matricule, sequence);
      this.statistiques.enCours++;

      // Enregistrer le pesage dans la base dès l'arrivée (statut EN_ATTENTE)
      await this.enregistrerOuMettreAJourPesage(sequence);

      // Effectuer le premier pesage immédiatement
      await this.effectuerPremierPesage(sequence, dataExcel);

      console.log(`🚛 Arrivée camion ${sequence.matricule} (${direction}) - Ticket: ${sequence.ticket}`);

    } catch (error) {
      console.error(`❌ Erreur lors de la création de l'arrivée ${this.currentIndex}:`, error.message);
    }
  }

  /**
   * Effectue le premier pesage
   */
  async effectuerPremierPesage(sequence, dataExcel) {
    console.log(`🔍 Effectuer premier pesage pour ${sequence.matricule}, produit: "${sequence.produit}", id_produit: ${sequence.id_produit}`);
    // Générer une heure réaliste (8h-18h) - Format HH:MM comme dans Excel
    const hour = 8 + Math.floor(Math.random() * 10);
    const minute = Math.floor(Math.random() * 60);
    const heure = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`; // Format HH:MM:SS pour la base

    // Utiliser les données Excel ou générer des valeurs réalistes EN TONNES
    let poids;
    if (sequence.typeSequence === 'TARE_FIRST') {
      // Premier pesage = TARE (en tonnes, comme dans les fichiers Excel)
      poids = dataExcel.tare || parseFloat((6 + Math.random() * 12).toFixed(3)); // 6-18 tonnes
    } else {
      // Premier pesage = BRUT (en tonnes)
      poids = dataExcel.brut || parseFloat((30 + Math.random() * 20).toFixed(3)); // 30-50 tonnes
    }

    // Ajouter variation réaliste (±0.1%)
    poids = parseFloat((poids * (1 + (Math.random() * 0.002 - 0.001))).toFixed(3));

    sequence.enregistrerPremierPesage(poids, heure);
    console.log(`✅ Premier pesage enregistré pour ${sequence.matricule}: ${poids}t (${sequence.typeSequence === 'TARE_FIRST' ? 'TARE' : 'BRUT'})`);
    
    // Mettre à jour le pesage dans la base (statut PREMIER_MESURE)
    await this.enregistrerOuMettreAJourPesage(sequence);
    
    // Passer en zone après un court délai (simulation)
    console.log(`⏰ Programmation passage en zone pour ${sequence.matricule} dans 2 secondes`);
    setTimeout(async () => {
      await this.passerEnZone(sequence);
    }, 2000); // 2 secondes après le premier pesage
  }

  /**
   * Simule le passage en zone
   */
  async passerEnZone(sequence) {
    const delai = this.config.delaiZoneMin + 
                  Math.floor(Math.random() * (this.config.delaiZoneMax - this.config.delaiZoneMin));
    
    console.log(`🔍 Passage en zone pour ${sequence.matricule}, délai: ${delai} secondes`);
    
    sequence.passerEnZone(delai);
    this.statistiques.enZone++;
    this.statistiques.enCours--;

    // Mettre à jour le pesage dans la base (statut EN_ZONE)
    await this.enregistrerOuMettreAJourPesage(sequence);

    // Programmer le deuxième pesage après le délai
    const delaiMs = delai * 1000 / this.config.speed;
    console.log(`⏰ Programmation 2e pesage pour ${sequence.matricule} dans ${delaiMs}ms (${delai}s)`);
    
    setTimeout(async () => {
      console.log(`⏰ Déclenchement 2e pesage pour ${sequence.matricule}`);
      await this.effectuerDeuxiemePesage(sequence);
    }, delaiMs);
  }

  /**
   * Effectue le deuxième pesage
   */
  async effectuerDeuxiemePesage(sequence) {
    console.log(`🔍 Effectuer deuxième pesage pour ${sequence.matricule}, type: ${sequence.typeSequence}`);
    // Calculer l'heure du deuxième pesage
    const [h, m, s] = sequence.premierPesage.heure.split(':').map(Number);
    const premierTimestamp = new Date();
    premierTimestamp.setHours(h, m, s);
    
    const deuxiemeTimestamp = new Date(premierTimestamp.getTime() + sequence.delaiZone * 1000);
    const heure = `${String(deuxiemeTimestamp.getHours()).padStart(2, '0')}:${String(deuxiemeTimestamp.getMinutes()).padStart(2, '0')}:${String(deuxiemeTimestamp.getSeconds()).padStart(2, '0')}`;

    // Utiliser les données Excel ou calculer EN TONNES
    let poids;
    const dataExcel = this.pesagesData.find(d => d.camion === sequence.matricule);
    
    if (sequence.typeSequence === 'TARE_FIRST') {
      // Deuxième pesage = BRUT (en tonnes)
      if (dataExcel && dataExcel.brut) {
        poids = dataExcel.brut;
      } else {
        // BRUT = TARE + NET (avec variation, en tonnes)
        const net = dataExcel?.net || parseFloat((20 + Math.random() * 15).toFixed(3)); // 20-35 tonnes
        poids = parseFloat((sequence.tare + net).toFixed(3));
      }
    } else {
      // Deuxième pesage = TARE (en tonnes)
      if (dataExcel && dataExcel.tare) {
        poids = dataExcel.tare;
      } else {
        // TARE = BRUT - NET (avec variation, en tonnes)
        const net = dataExcel?.net || parseFloat((20 + Math.random() * 15).toFixed(3)); // 20-35 tonnes
        poids = parseFloat((sequence.brut - net).toFixed(3));
      }
    }

    // Ajouter variation réaliste (±0.1%)
    poids = parseFloat((poids * (1 + (Math.random() * 0.002 - 0.001))).toFixed(3));

    // S'assurer que BRUT >= TARE
    if (sequence.typeSequence === 'TARE_FIRST') {
      if (poids < sequence.tare) {
        poids = parseFloat((sequence.tare + 0.5).toFixed(3)); // Marge minimale en tonnes
      }
    } else {
      if (poids > sequence.brut) {
        poids = parseFloat((sequence.brut - 0.5).toFixed(3)); // Marge minimale en tonnes
      }
    }

    sequence.enregistrerDeuxiemePesage(poids, heure);
    this.statistiques.enZone--;

    // Mettre à jour le pesage dans la base (statut DEUXIEME_MESURE)
    await this.enregistrerOuMettreAJourPesage(sequence);

    // Finaliser le pesage (statut COMPLET)
    sequence.statut = 'COMPLET';
    await this.enregistrerOuMettreAJourPesage(sequence);
    
    this.statistiques.completes++;
    this.statistiques.total++;
    console.log(`✅ Pesage complet finalisé: ${sequence.matricule} - Ticket: ${sequence.ticket} - Net: ${sequence.net}t`);
    
    // Retirer de la liste des séquences en cours
    this.sequencesEnCours.delete(sequence.matricule);
  }

  /**
   * Enregistre ou met à jour un pesage dans la base de données (à chaque étape)
   * Fonctionne même si la séquence n'est pas complète
   */
  async enregistrerOuMettreAJourPesage(sequence) {
    try {
      // Vérifier que le produit existe
      let id_produit = sequence.id_produit;
      if (!id_produit && sequence.produit) {
        id_produit = await this.trouverOuCreerProduit(sequence.produit);
        sequence.id_produit = id_produit;
      }

      if (!id_produit) {
        console.error(`❌ Impossible d'enregistrer le pesage ${sequence.matricule}: pas de produit`);
        return;
      }

      // Si le pesage existe déjà, on le met à jour
      if (sequence.id_pesage) {
        const [result] = await pool.query(
          `UPDATE pesages 
           SET statut = ?, 
               premier_pesage = ?, 
               deuxieme_pesage = ?,
               heure_premier_pesage = ?,
               heure_deuxieme_pesage = ?,
               delai_zone = ?,
               tare = ?,
               brut = ?,
               net = ?,
               heure = ?
           WHERE id_pesage = ?`,
          [
            sequence.statut,
            sequence.premierPesage.poids,
            sequence.deuxiemePesage.poids,
            sequence.premierPesage.heure,
            sequence.deuxiemePesage.heure,
            sequence.delaiZone,
            sequence.tare || 0,
            sequence.brut || 0,
            sequence.net || 0,
            sequence.deuxiemePesage.heure || sequence.premierPesage.heure || new Date().toTimeString().split(' ')[0],
            sequence.id_pesage
          ]
        );
        console.log(`🔄 Pesage ${sequence.id_pesage} mis à jour: statut = ${sequence.statut}`);
        return;
      }

      // Sinon, on crée un nouveau pesage (même incomplet)
      const heure = sequence.deuxiemePesage.heure || sequence.premierPesage.heure || new Date().toTimeString().split(' ')[0];
      
      const [result] = await pool.query(
        `INSERT INTO pesages 
         (id_produit, date_pesage, camion, heure, ticket, tare, brut, net,
          type_pesage, premier_pesage, deuxieme_pesage, statut,
          heure_premier_pesage, heure_deuxieme_pesage, delai_zone, client, direction) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_produit,
          sequence.date_pesage,
          sequence.matricule,
          heure,
          sequence.ticket,
          sequence.tare || 0,
          sequence.brut || 0,
          sequence.net || 0,
          sequence.typeSequence,
          sequence.premierPesage.poids,
          sequence.deuxiemePesage.poids,
          sequence.statut,
          sequence.premierPesage.heure,
          sequence.deuxiemePesage.heure,
          sequence.delaiZone,
          sequence.client,
          sequence.direction
        ]
      );

      sequence.id_pesage = result.insertId;
      console.log(`✅ Pesage ${sequence.id_pesage} créé: statut = ${sequence.statut}`);

    } catch (error) {
      console.error(`❌ Erreur lors de l'enregistrement/mise à jour du pesage ${sequence.matricule}:`, error);
    }
  }

  /**
   * Enregistre un pesage complet dans la base de données
   */
  async enregistrerPesage(sequence) {
    console.log(`🔍 Enregistrement pesage pour ${sequence.matricule}, produit: "${sequence.produit}", id_produit: ${sequence.id_produit}, statut: ${sequence.statut}`);
    try {
      const validation = sequence.valider();
      if (!validation.valide) {
        console.error(`❌ Séquence invalide pour ${sequence.matricule}:`, validation.erreurs);
        sequence.statut = 'ANNULE';
        this.statistiques.annules++;
        return;
      }

      const data = sequence.toDatabaseObject();

      // Vérifier que le produit existe
      const [produitRows] = await pool.query(
        'SELECT * FROM produits WHERE id_produit = ?',
        [data.id_produit]
      );

      if (produitRows.length === 0) {
        console.log(`⚠️ Produit ${data.id_produit} non trouvé, recherche du produit par nom: "${sequence.produit}"`);
        // Chercher le produit par nom au lieu d'utiliser un produit par défaut
        if (sequence.produit) {
          const produitTrouve = await this.trouverOuCreerProduit(sequence.produit);
          if (produitTrouve) {
            data.id_produit = produitTrouve;
            console.log(`✅ Produit trouvé/créé par nom: ${data.id_produit} pour "${sequence.produit}"`);
          } else {
            console.error(`❌ Impossible de trouver/créer le produit "${sequence.produit}"`);
            sequence.statut = 'ANNULE';
            this.statistiques.annules++;
            return;
          }
        } else {
          console.error(`❌ Aucun nom de produit disponible dans la séquence`);
          sequence.statut = 'ANNULE';
          this.statistiques.annules++;
          return;
        }
      } else {
        console.log(`✅ Produit ${data.id_produit} trouvé: "${produitRows[0].nom_produit}"`);
        
        // Vérifier que le produit trouvé correspond bien au nom du CSV
        // Si le nom ne correspond pas, chercher/créer le bon produit
        if (sequence.produit && sequence.produit !== produitRows[0].nom_produit) {
          console.log(`⚠️  Produit ${data.id_produit} ne correspond pas au nom "${sequence.produit}", recherche du bon produit...`);
          const produitCorrect = await this.trouverOuCreerProduit(sequence.produit);
          if (produitCorrect) {
            data.id_produit = produitCorrect;
            console.log(`✅ Produit corrigé: ${data.id_produit} pour "${sequence.produit}"`);
          }
        }
      }

      // Insérer le pesage
      const [result] = await pool.query(
        `INSERT INTO pesages 
         (id_produit, date_pesage, camion, heure, ticket, tare, brut, net,
          type_pesage, premier_pesage, deuxieme_pesage, statut,
          heure_premier_pesage, heure_deuxieme_pesage, delai_zone, client, direction) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id_produit,
          data.date_pesage,
          data.camion,
          data.heure,
          data.ticket,
          data.tare,
          data.brut,
          data.net,
          data.type_pesage,
          data.premier_pesage,
          data.deuxieme_pesage,
          data.statut,
          data.heure_premier_pesage,
          data.heure_deuxieme_pesage,
          data.delai_zone,
          data.client,
          data.direction
        ]
      );

      // Retirer de la map des séquences en cours
      this.sequencesEnCours.delete(sequence.matricule);
      this.statistiques.completes++;

      console.log(`✅ Pesage complet enregistré: ${sequence.matricule} - Ticket: ${sequence.ticket} - Net: ${sequence.net}t`);

    } catch (error) {
      console.error(`❌ Erreur lors de l'enregistrement du pesage ${sequence.matricule}:`, error.message);
      sequence.statut = 'ANNULE';
      this.statistiques.annules++;
    }
  }

  /**
   * Traite les séquences en cours (vérification périodique)
   */
  processSequencesEnCours() {
    // Cette méthode est appelée périodiquement pour vérifier l'état
    // Des timeouts gèrent déjà les transitions, mais on peut ajouter des vérifications ici
  }

  /**
   * Obtient le statut de la simulation
   */
  getStatus() {
    const sequencesArray = Array.from(this.sequencesEnCours.values()).map(s => s.getResume());
    
    return {
      isRunning: this.isRunning,
      currentIndex: this.currentIndex,
      total: this.pesagesData.length,
      progress: this.pesagesData.length > 0 
        ? Math.round((this.currentIndex / this.pesagesData.length) * 100) 
        : 0,
      statistiques: this.statistiques,
      sequencesEnCours: sequencesArray,
      config: this.config
    };
  }

  /**
   * Réinitialise la simulation
   */
  reset() {
    this.stop();
    this.currentIndex = 0;
    this.pesagesData = [];
    this.sequencesEnCours.clear();
    this.config = null;
    this.statistiques = {
      total: 0,
      completes: 0,
      enCours: 0,
      enZone: 0,
      annules: 0
    };
    this.ticketCounter = null;
  }

  /**
   * Auto-démarre la simulation avec des données générées
   * Génère automatiquement des données de test si aucune donnée n'est chargée
   */
  async autoStart() {
    console.log('\n🚀 ============================================');
    console.log('🚀 AUTO-DÉMARRAGE DE LA SIMULATION');
    console.log('🚀 ============================================\n');
    
    if (this.isRunning) {
      console.log('✅ Simulation déjà en cours');
      return { success: true, message: 'Simulation déjà en cours' };
    }

    // Si aucune donnée n'est chargée, charger le fichier CSV réel
    if (this.pesagesData.length === 0) {
      console.log('📦 Aucune donnée chargée, chargement du fichier CSV...');
      console.log('🔄 Chargement du fichier CSV réel peseeliste.csv...');
      const path = require('path');
      const fs = require('fs');
      const { parseCsvFile } = require('../utils/csvParser');
      
      try {
        // Chemin depuis backend/src/services/ vers peseeliste.csv à la racine
        const csvPath = path.join(__dirname, '../../../peseeliste.csv');
        
        console.log(`📂 Recherche du fichier CSV: ${csvPath}`);
        
        if (!fs.existsSync(csvPath)) {
          console.warn(`⚠️  Fichier CSV non trouvé à ${csvPath}`);
          console.warn('⚠️  Génération de données de test...');
          const { generateTestData } = require('../utils/testDataGenerator');
          const testData = await generateTestData(200);
          this.loadData(testData, {
            intervalArrivee: 30000,
            delaiZoneMin: 120,
            delaiZoneMax: 300,
            speed: 1,
            startDate: new Date().toISOString().split('T')[0]
          });
          return;
        }
        
        // Lire le fichier CSV réel
        const csvData = parseCsvFile(csvPath);
        
        if (csvData.length === 0) {
          throw new Error('Aucune donnée trouvée dans le fichier CSV');
        }
        
        this.loadData(csvData, {
          intervalArrivee: 5000, // 5 secondes entre les arrivées (plus rapide pour voir les données)
          delaiZoneMin: 5, // 5 secondes en zone (beaucoup plus rapide)
          delaiZoneMax: 10, // 10 secondes max en zone
          speed: 1,
          startDate: new Date().toISOString().split('T')[0]
        });
        
        console.log(`✅ ${csvData.length} pesages chargés depuis le fichier CSV réel`);
      } catch (error) {
        console.error('❌ Erreur lors du chargement du fichier CSV:', error);
        console.error('❌ Détails:', error.message);
        // Fallback sur génération de données
        const { generateTestData } = require('../utils/testDataGenerator');
        const testData = await generateTestData(200);
        this.loadData(testData, {
          intervalArrivee: 30000,
          delaiZoneMin: 120,
          delaiZoneMax: 300,
          speed: 1,
          startDate: new Date().toISOString().split('T')[0]
        });
      }
    }

    // Démarrer la simulation
    try {
      this.start();
      return { 
        success: true, 
        message: 'Simulation démarrée automatiquement',
        status: this.getStatus()
      };
    } catch (error) {
      console.error('❌ Erreur lors du démarrage automatique:', error);
      throw error;
    }
  }
}

// Instance singleton
const simulationService = new SimulationService();

module.exports = simulationService;

