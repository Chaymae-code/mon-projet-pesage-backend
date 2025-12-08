// ============================================
// MODÈLE : CATÉGORIE
// ============================================
// Représente une catégorie de produits (Céréales, Légumes, Fruits, etc.)

class Categorie {
  /**
   * Constructeur d'une catégorie
   * @param {number} id_categorie - ID unique de la catégorie
   * @param {string} nom_categorie - Nom de la catégorie (ex: "Céréales")
   */
  constructor(id_categorie, nom_categorie) {
    this.id_categorie = id_categorie;
    this.nom_categorie = nom_categorie;
  }

  /**
   * Vérifie si la catégorie est valide
   * @returns {boolean} true si valide, false sinon
   */
  isValid() {
    return this.nom_categorie && this.nom_categorie.trim().length > 0;
  }

  /**
   * Convertit la catégorie en objet simple (pour JSON)
   * @returns {object} Objet représentant la catégorie
   */
  toJSON() {
    return {
      id_categorie: this.id_categorie,
      nom_categorie: this.nom_categorie
    };
  }

  /**
   * Crée une catégorie à partir d'un objet (venant de la base de données)
   * @param {object} data - Données brutes
   * @returns {Categorie} Instance de Categorie
   */
  static fromDatabase(data) {
    return new Categorie(
      data.id_categorie,
      data.nom_categorie
    );
  }

  /**
   * Exemples de catégories pré-définies
   * @returns {Array<Categorie>} Liste de catégories exemples
   */
  static getExamples() {
    return [
      new Categorie(1, 'Céréales'),
      new Categorie(2, 'Légumes'),
      new Categorie(3, 'Fruits'),
      new Categorie(4, 'Produits laitiers'),
      new Categorie(5, 'Viandes')
    ];
  }
}

// Exporte la classe pour pouvoir l'utiliser ailleurs
module.exports = Categorie;