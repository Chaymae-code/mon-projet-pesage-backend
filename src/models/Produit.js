// ============================================
// MODÈLE : PRODUIT
// ============================================
// Représente un produit (Blé, Maïs, Tomates, etc.)

class Produit {
  /**
   * Constructeur d'un produit
   * @param {number} id_produit - ID unique du produit
   * @param {string} nom_produit - Nom du produit
   * @param {number} id_categorie - ID de la catégorie parente
   * @param {number} nombre_camions - Nombre de camions pour ce produit
   * @param {number} tonnage - Tonnage total (en tonnes)
   */
  constructor(id_produit, nom_produit, id_categorie, nombre_camions, tonnage) {
    this.id_produit = id_produit;
    this.nom_produit = nom_produit;
    this.id_categorie = id_categorie;
    this.nombre_camions = nombre_camions || 0;
    this.tonnage = tonnage || 0.0;
  }

  /**
   * Vérifie si le produit est valide
   * @returns {boolean} true si valide, false sinon
   */
  isValid() {
    return (
      this.nom_produit &&
      this.nom_produit.trim().length > 0 &&
      this.id_categorie > 0
    );
  }

  /**
   * Convertit le produit en objet simple
   * @returns {object} Objet représentant le produit
   */
  toJSON() {
    return {
      id_produit: this.id_produit,
      nom_produit: this.nom_produit,
      id_categorie: this.id_categorie,
      nombre_camions: this.nombre_camions,
      tonnage: this.tonnage
    };
  }

  /**
   * Crée un produit à partir d'un objet
   * @param {object} data - Données brutes
   * @returns {Produit} Instance de Produit
   */
  static fromDatabase(data) {
    return new Produit(
      data.id_produit,
      data.nom_produit,
      data.id_categorie,
      data.nombre_camions,
      data.tonnage
    );
  }

  /**
   * Formate le tonnage pour l'affichage
   * @returns {string} Tonnage formaté avec unité
   */
  formatTonnage() {
    return `${this.tonnage.toLocaleString('fr-FR')} t`;
  }

  /**
   * Exemples de produits pré-définis
   * @returns {Array<Produit>} Liste de produits exemples
   */
  static getExamples() {
    return [
      new Produit(26, 'Blé', 1, 10, 500.0),
      new Produit(27, 'Maïs', 1, 8, 400.0),
      new Produit(28, 'Orge', 1, 5, 300.0),
      new Produit(31, 'Tomates', 2, 15, 200.0),
      new Produit(32, 'Carottes', 2, 12, 150.0),
      new Produit(33, 'Pommes', 3, 20, 600.0)
    ];
  }
}

module.exports = Produit;