// ============================================
// MODÈLE : PESAGE
// ============================================
// Représente une pesée individuelle

class Pesage {
  /**
   * Constructeur d'un pesage
   * @param {number} id_pesage - ID unique du pesage
   * @param {number} id_produit - ID du produit pesé
   * @param {Date|string} date_pesage - Date du pesage
   * @param {string} camion - Numéro du camion
   * @param {string} heure - Heure du pesage (HH:MM:SS)
   * @param {string} ticket - Numéro de ticket
   * @param {number} tare - Poids à vide (tare)
   * @param {number} brut - Poids brut
   * @param {number} net - Poids net (brut - tare)
   */
  constructor(id_pesage, id_produit, date_pesage, camion, heure, ticket, tare, brut, net) {
    this.id_pesage = id_pesage;
    this.id_produit = id_produit;
    this.date_pesage = date_pesage;
    this.camion = camion;
    this.heure = heure;
    this.ticket = ticket;
    this.tare = tare || 0.0;
    this.brut = brut || 0.0;
    this.net = net || 0.0;
  }

  /**
   * Vérifie si le pesage est valide
   * @returns {boolean} true si valide, false sinon
   */
  isValid() {
    return (
      this.id_produit > 0 &&
      this.camion &&
      this.camion.trim().length > 0 &&
      this.tare >= 0 &&
      this.brut >= 0 &&
      this.net >= 0
    );
  }

  /**
   * Convertit le pesage en objet simple
   * @returns {object} Objet représentant le pesage
   */
  toJSON() {
    return {
      id_pesage: this.id_pesage,
      id_produit: this.id_produit,
      date_pesage: this.formatDate(),
      camion: this.camion,
      heure: this.heure,
      ticket: this.ticket,
      tare: this.tare,
      brut: this.brut,
      net: this.net,
      date_time: this.getDateTime()
    };
  }

  /**
   * Crée un pesage à partir d'un objet
   * @param {object} data - Données brutes
   * @returns {Pesage} Instance de Pesage
   */
  static fromDatabase(data) {
    return new Pesage(
      data.id_pesage,
      data.id_produit,
      data.date_pesage,
      data.camion,
      data.heure,
      data.ticket,
      parseFloat(data.tare),
      parseFloat(data.brut),
      parseFloat(data.net)
    );
  }

  /**
   * Formate la date pour l'affichage
   * @returns {string} Date formatée (DD/M/YY ou DD/MM/YYYY selon le format original)
   */
  formatDate() {
    if (!this.date_pesage) return '';
    
    // Si la date est déjà au format DD/M/YY ou DD/MM/YYYY, la retourner telle quelle
    if (typeof this.date_pesage === 'string' && this.date_pesage.includes('/')) {
      return this.date_pesage;
    }
    
    // Sinon, convertir depuis YYYY-MM-DD
    const date = new Date(this.date_pesage);
    if (isNaN(date.getTime())) {
      return this.date_pesage; // Retourner tel quel si pas une date valide
    }
    
    // Format DD/M/YY (comme dans les fichiers Excel réels)
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }

  /**
   * Combine date et heure pour obtenir un DateTime
   * @returns {Date} Objet Date avec date et heure
   */
  getDateTime() {
    if (!this.date_pesage || !this.heure) return null;
    
    const dateStr = new Date(this.date_pesage).toISOString().split('T')[0];
    return new Date(`${dateStr}T${this.heure}`);
  }

  /**
   * Calcule le poids net si non fourni
   * @returns {number} Poids net calculé
   */
  calculateNet() {
    return Math.max(0, this.brut - this.tare);
  }

  /**
   * Vérifie si le poids net est cohérent
   * @returns {boolean} true si cohérent, false sinon
   */
  isNetConsistent() {
    const calculatedNet = this.calculateNet();
    return Math.abs(this.net - calculatedNet) < 0.001;
  }

  /**
   * Exemples de pesages pré-définis
   * @returns {Array<Pesage>} Liste de pesages exemples
   */
  static getExamples() {
    return [
      new Pesage(1, 26, '2025-10-02', '44932A54', '19:52:00', '54167', 43.460, 15.420, 28.040),
      new Pesage(2, 26, '2025-10-02', '48143A54', '19:24:00', '54165', 43.000, 14.900, 28.100),
      new Pesage(3, 26, '2025-10-02', '44672A54', '18:08:00', '54162', 43.640, 15.540, 28.100)
    ];
  }
}

module.exports = Pesage;