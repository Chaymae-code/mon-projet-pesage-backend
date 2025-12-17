// ============================================
// MODÈLE : SEQUENCE PESAGE
// ============================================
// Gère une séquence complète de pesage (1er + 2e pesage)

class SequencePesage {
  /**
   * Constructeur d'une séquence de pesage
   * @param {Object} config - Configuration de la séquence
   */
  constructor(config = {}) {
    this.matricule = config.matricule || null;
    this.client = config.client || null;
    this.produit = config.produit || null;
    this.id_produit = config.id_produit || null;
    this.direction = config.direction || null; // 'ENTREE' ou 'SORTIE'
    this.typeSequence = config.typeSequence || null; // 'TARE_FIRST' ou 'BRUT_FIRST'
    
    // Premier pesage
    this.premierPesage = {
      type: null, // 'TARE' ou 'BRUT'
      poids: null,
      heure: null,
      timestamp: null
    };
    
    // Deuxième pesage
    this.deuxiemePesage = {
      type: null, // 'TARE' ou 'BRUT'
      poids: null,
      heure: null,
      timestamp: null
    };
    
    // Résultat final
    this.brut = null;
    this.tare = null;
    this.net = null;
    this.ticket = null;
    this.statut = 'EN_ATTENTE'; // 'EN_ATTENTE', 'PREMIER_MESURE', 'EN_ZONE', 'DEUXIEME_MESURE', 'COMPLET', 'ANNULE'
    this.date_pesage = config.date_pesage || new Date().toISOString().split('T')[0];
    
    // Délai en zone (en secondes)
    this.delaiZone = null;
  }

  /**
   * Détermine le type de séquence selon la direction
   * @param {string} direction - 'ENTREE' ou 'SORTIE'
   */
  determineTypeSequence(direction) {
    this.direction = direction;
    
    if (direction === 'ENTREE') {
      // Camion arrive vide, va charger
      // Premier pesage = TARE, Deuxième = BRUT
      this.typeSequence = 'TARE_FIRST';
      this.premierPesage.type = 'TARE';
      this.deuxiemePesage.type = 'BRUT';
    } else if (direction === 'SORTIE') {
      // Camion arrive chargé, va décharger
      // Premier pesage = BRUT, Deuxième = TARE
      this.typeSequence = 'BRUT_FIRST';
      this.premierPesage.type = 'BRUT';
      this.deuxiemePesage.type = 'TARE';
    }
  }

  /**
   * Enregistre le premier pesage
   * @param {number} poids - Poids mesuré
   * @param {string} heure - Heure du pesage (HH:MM:SS)
   */
  enregistrerPremierPesage(poids, heure) {
    this.premierPesage.poids = poids;
    this.premierPesage.heure = heure;
    this.premierPesage.timestamp = new Date();
    this.statut = 'PREMIER_MESURE';
    
    // Si c'est TARE_FIRST, on a déjà la tare
    if (this.typeSequence === 'TARE_FIRST') {
      this.tare = poids;
    } else if (this.typeSequence === 'BRUT_FIRST') {
      this.brut = poids;
    }
  }

  /**
   * Simule le passage en zone (charge/décharge)
   * @param {number} delaiSecondes - Délai en secondes (défaut: 120-300s)
   */
  passerEnZone(delaiSecondes = null) {
    if (!delaiSecondes) {
      // Délai réaliste entre 2 et 5 minutes
      delaiSecondes = 120 + Math.floor(Math.random() * 180);
    }
    
    this.delaiZone = delaiSecondes;
    this.statut = 'EN_ZONE';
  }

  /**
   * Enregistre le deuxième pesage
   * @param {number} poids - Poids mesuré
   * @param {string} heure - Heure du pesage (HH:MM:SS)
   */
  enregistrerDeuxiemePesage(poids, heure) {
    this.deuxiemePesage.poids = poids;
    this.deuxiemePesage.heure = heure;
    this.deuxiemePesage.timestamp = new Date();
    this.statut = 'DEUXIEME_MESURE';
    
    // Compléter selon le type de séquence
    if (this.typeSequence === 'TARE_FIRST') {
      // On avait la tare, maintenant on a le brut
      this.brut = poids;
    } else if (this.typeSequence === 'BRUT_FIRST') {
      // On avait le brut, maintenant on a la tare
      this.tare = poids;
    }
    
    // Calculer le net
    this.calculerNet();
  }

  /**
   * Calcule le poids net
   */
  calculerNet() {
    if (this.brut !== null && this.tare !== null) {
      this.net = Math.max(0, this.brut - this.tare);
      this.statut = 'COMPLET';
    }
  }

  /**
   * Génère un numéro de ticket unique
   * @param {number} baseTicket - Numéro de base (optionnel)
   */
  genererTicket(baseTicket = null) {
    if (baseTicket) {
      this.ticket = String(baseTicket);
    } else {
      // Générer un ticket séquentiel (format: timestamp + random)
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      this.ticket = `${timestamp}-${random}`;
    }
  }

  /**
   * Valide la séquence complète
   * @returns {Object} { valide: boolean, erreurs: string[] }
   */
  valider() {
    const erreurs = [];
    
    if (!this.matricule) {
      erreurs.push('Matricule manquant');
    }
    
    if (!this.premierPesage.poids) {
      erreurs.push('Premier pesage manquant');
    }
    
    if (!this.deuxiemePesage.poids) {
      erreurs.push('Deuxième pesage manquant');
    }
    
    if (this.brut === null || this.tare === null) {
      erreurs.push('Poids brut ou tare manquant');
    }
    
    if (this.brut !== null && this.tare !== null && this.brut < this.tare) {
      erreurs.push('Le poids brut doit être supérieur ou égal à la tare');
    }
    
    if (this.net === null || this.net < 0) {
      erreurs.push('Poids net invalide');
    }
    
    return {
      valide: erreurs.length === 0,
      erreurs: erreurs
    };
  }

  /**
   * Convertit la séquence en objet pour insertion en base
   * @returns {Object} Objet prêt pour INSERT
   */
  toDatabaseObject() {
    const validation = this.valider();
    if (!validation.valide) {
      throw new Error(`Séquence invalide: ${validation.erreurs.join(', ')}`);
    }
    
    return {
      id_produit: this.id_produit,
      date_pesage: this.date_pesage,
      camion: this.matricule,
      heure: this.deuxiemePesage.heure || this.premierPesage.heure, // Heure finale
      ticket: this.ticket,
      tare: this.tare,
      brut: this.brut,
      net: this.net,
      type_pesage: this.typeSequence,
      premier_pesage: this.premierPesage.poids,
      deuxieme_pesage: this.deuxiemePesage.poids,
      statut: this.statut,
      heure_premier_pesage: this.premierPesage.heure,
      heure_deuxieme_pesage: this.deuxiemePesage.heure,
      delai_zone: this.delaiZone,
      client: this.client,
      direction: this.direction
    };
  }

  /**
   * Obtient un résumé de la séquence
   * @returns {Object} Résumé
   */
  getResume() {
    return {
      matricule: this.matricule,
      client: this.client,
      produit: this.produit,
      direction: this.direction,
      typeSequence: this.typeSequence,
      statut: this.statut,
      premierPesage: {
        type: this.premierPesage.type,
        poids: this.premierPesage.poids,
        heure: this.premierPesage.heure
      },
      deuxiemePesage: {
        type: this.deuxiemePesage.type,
        poids: this.deuxiemePesage.poids,
        heure: this.deuxiemePesage.heure
      },
      resultat: {
        tare: this.tare,
        brut: this.brut,
        net: this.net
      },
      delaiZone: this.delaiZone,
      ticket: this.ticket
    };
  }
}

module.exports = SequencePesage;




