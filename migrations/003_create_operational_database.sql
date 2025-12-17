-- ============================================
-- MIGRATION : CRÉATION BASE OPÉRATIONNELLE
-- ============================================
-- Cette migration crée la base de données opérationnelle
-- pour gérer le workflow temps réel (planification, pesages actifs, quotas)
-- 
-- IMPORTANT : Cette base est SÉPARÉE de la base historique (pesage_db)
-- ============================================

-- ============================================
-- 1. CRÉATION DE LA BASE DE DONNÉES
-- ============================================
CREATE DATABASE IF NOT EXISTS pesage_operational 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pesage_operational;

-- ============================================
-- 2. TABLE : DAILY_PLANNING
-- ============================================
-- Contient la planification quotidienne des camions
-- Le matricule est utilisé pour la recherche depuis OpenCV
CREATE TABLE daily_planning (
    id_planning INT AUTO_INCREMENT PRIMARY KEY,
    date_planning DATE NOT NULL,
    matricule VARCHAR(50) NOT NULL COMMENT 'Plaque d''immatriculation (clé de recherche OpenCV)',
    driver_name VARCHAR(100) NULL COMMENT 'Nom du conducteur',
    client_name VARCHAR(100) NOT NULL COMMENT 'Nom du client',
    id_produit INT NOT NULL COMMENT 'Référence à pesage_db.produits.id_produit',
    operation_type ENUM('LOADING', 'UNLOADING') NOT NULL COMMENT 'Type d''opération',
    planned_quantity DECIMAL(10,3) NULL COMMENT 'Quantité prévue en tonnes',
    scheduled_time TIME NULL COMMENT 'Heure prévue d''arrivée',
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING' COMMENT 'Statut de la planification',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_date (date_planning),
    INDEX idx_matricule (matricule) COMMENT 'Index pour recherche rapide depuis OpenCV',
    INDEX idx_status (status),
    INDEX idx_client (client_name),
    INDEX idx_date_matricule (date_planning, matricule) COMMENT 'Index composite pour recherche optimale'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TABLE : ACTIVE_WEIGHINGS
-- ============================================
-- Contient les pesages en cours (workflow temps réel)
-- État initial : ARRIVAL (après détection OpenCV)
CREATE TABLE active_weighings (
    id_weighing INT AUTO_INCREMENT PRIMARY KEY,
    id_planning INT NULL COMMENT 'Référence à daily_planning (optionnel si arrivée non planifiée)',
    matricule VARCHAR(50) NOT NULL COMMENT 'Matricule détecté par OpenCV',
    client_name VARCHAR(100) NOT NULL COMMENT 'Nom du client',
    id_produit INT NOT NULL COMMENT 'Référence à pesage_db.produits.id_produit',
    operation_type ENUM('LOADING', 'UNLOADING') NOT NULL COMMENT 'Type d''opération',
    
    -- Machine à états
    current_state ENUM(
        'ARRIVAL',           -- État initial après détection OpenCV
        'ENTRY_WEIGHING',    -- Premier pesage en cours
        'LOADING',           -- En chargement
        'UNLOADING',         -- En déchargement
        'EXIT_WEIGHING',     -- Deuxième pesage en cours
        'COMPLETED',         -- Pesage complété (prêt pour transfert historique)
        'CANCELLED'          -- Pesage annulé
    ) DEFAULT 'ARRIVAL' COMMENT 'État actuel du pesage',
    
    -- Poids (progressifs depuis calculateur)
    entry_weight DECIMAL(10,3) NULL COMMENT 'Poids du premier pesage',
    exit_weight DECIMAL(10,3) NULL COMMENT 'Poids du deuxième pesage',
    tare DECIMAL(10,3) NULL COMMENT 'Poids à vide (calculé)',
    brut DECIMAL(10,3) NULL COMMENT 'Poids brut (calculé)',
    net DECIMAL(10,3) NULL COMMENT 'Poids net (calculé)',
    
    -- Timestamps
    arrival_time TIMESTAMP NULL COMMENT 'Moment de détection OpenCV',
    entry_weighing_time TIMESTAMP NULL COMMENT 'Début premier pesage',
    zone_entry_time TIMESTAMP NULL COMMENT 'Entrée en zone (chargement/déchargement)',
    exit_weighing_time TIMESTAMP NULL COMMENT 'Début deuxième pesage',
    completion_time TIMESTAMP NULL COMMENT 'Moment de finalisation',
    
    -- Ticket
    ticket_number VARCHAR(50) NULL COMMENT 'Numéro de ticket généré à la finalisation',
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_matricule (matricule),
    INDEX idx_state (current_state),
    INDEX idx_planning (id_planning),
    INDEX idx_client (client_name),
    INDEX idx_date (created_at),
    INDEX idx_state_date (current_state, created_at) COMMENT 'Index pour requêtes dashboard'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. TABLE : CLIENT_QUOTAS
-- ============================================
-- Gestion des quotas clients avec blocage automatique
CREATE TABLE client_quotas (
    id_quota INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Nom du client (unique)',
    total_quota DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Quota total en tonnes',
    consumed_quota DECIMAL(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Quota consommé en tonnes',
    remaining_quota DECIMAL(10,3) GENERATED ALWAYS AS (total_quota - consumed_quota) STORED COMMENT 'Quota restant (calculé automatiquement)',
    is_blocked BOOLEAN DEFAULT FALSE COMMENT 'Client bloqué si quota dépassé',
    blocked_at TIMESTAMP NULL COMMENT 'Date/heure de blocage',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_client (client_name),
    INDEX idx_blocked (is_blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. DONNÉES DE TEST (OPTIONNEL)
-- ============================================
-- Vous pouvez commenter cette section si vous ne voulez pas de données de test

-- Exemple de planification
INSERT INTO daily_planning 
(date_planning, matricule, driver_name, client_name, id_produit, operation_type, planned_quantity, scheduled_time)
VALUES 
('2025-01-15', '792A81', 'Ahmed Benali', 'ATM', 1, 'LOADING', 30.000, '10:00:00'),
('2025-01-15', '4881A50', 'Mohamed Alami', 'MCP', 2, 'UNLOADING', 25.000, '11:00:00'),
('2025-01-15', '44932A54', 'Fatima Zahra', 'DCP', 3, 'LOADING', 35.000, '12:00:00')
ON DUPLICATE KEY UPDATE matricule = VALUES(matricule);

-- Exemple de quotas clients
INSERT INTO client_quotas 
(client_name, total_quota, consumed_quota, is_blocked)
VALUES 
('ATM', 500.000, 0.000, FALSE),
('MCP', 300.000, 0.000, FALSE),
('DCP', 400.000, 0.000, FALSE),
('PORT', 200.000, 0.000, FALSE),
('FERTITECH', 150.000, 0.000, FALSE)
ON DUPLICATE KEY UPDATE client_name = VALUES(client_name);

-- ============================================
-- 6. VÉRIFICATION
-- ============================================
SELECT '✅ Base de données opérationnelle créée avec succès !' AS message;
SELECT COUNT(*) AS nombre_planifications FROM daily_planning;
SELECT COUNT(*) AS nombre_quotas FROM client_quotas;
SELECT COUNT(*) AS nombre_pesages_actifs FROM active_weighings;

-- Afficher la structure des tables
DESCRIBE daily_planning;
DESCRIBE active_weighings;
DESCRIBE client_quotas;

-- ============================================
-- FIN DU SCRIPT
-- ============================================
-- Après exécution :
-- 1. Vérifier que toutes les tables sont créées
-- 2. Vérifier les données de test (si activées)
-- 3. Configurer la connexion dans backend/src/config/operationalDatabase.js
-- ============================================
