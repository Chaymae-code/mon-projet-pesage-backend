-- ============================================
-- MIGRATION : Enrichissement de la table pesages
-- ============================================
-- Ajoute les colonnes nécessaires pour la simulation
-- de pesage avec logique 1er/2e pesage

-- Vérifier si les colonnes existent déjà avant de les ajouter
-- (pour éviter les erreurs si la migration est relancée)

-- Type de séquence de pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'type_pesage'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN type_pesage ENUM(''TARE_FIRST'', ''BRUT_FIRST'') NULL COMMENT ''Type de séquence de pesage (TARE en premier ou BRUT en premier)'' AFTER net',
    'SELECT ''Colonne type_pesage existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Premier pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'premier_pesage'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN premier_pesage DECIMAL(10,3) NULL COMMENT ''Poids du premier pesage (TARE ou BRUT selon type_pesage)'' AFTER type_pesage',
    'SELECT ''Colonne premier_pesage existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Deuxième pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'deuxieme_pesage'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN deuxieme_pesage DECIMAL(10,3) NULL COMMENT ''Poids du deuxième pesage (complémentaire du premier)'' AFTER premier_pesage',
    'SELECT ''Colonne deuxieme_pesage existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Statut du pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'statut'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN statut ENUM(''TARE_MESUREE'', ''BRUT_MESURE'', ''COMPLET'', ''ANNULE'') DEFAULT ''COMPLET'' COMMENT ''Statut du pesage dans la séquence'' AFTER deuxieme_pesage',
    'SELECT ''Colonne statut existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Heure premier pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'heure_premier_pesage'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN heure_premier_pesage TIME NULL COMMENT ''Heure du premier pesage'' AFTER statut',
    'SELECT ''Colonne heure_premier_pesage existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Heure deuxième pesage
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'heure_deuxieme_pesage'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN heure_deuxieme_pesage TIME NULL COMMENT ''Heure du deuxième pesage'' AFTER heure_premier_pesage',
    'SELECT ''Colonne heure_deuxieme_pesage existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Délai en zone
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'delai_zone'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN delai_zone INT NULL COMMENT ''Délai en secondes entre les deux pesages (temps en zone)'' AFTER heure_deuxieme_pesage',
    'SELECT ''Colonne delai_zone existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Client
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'client'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN client VARCHAR(100) NULL COMMENT ''Nom du client (depuis Excel)'' AFTER delai_zone',
    'SELECT ''Colonne client existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Direction
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'direction'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE pesages ADD COLUMN direction ENUM(''ENTREE'', ''SORTIE'') NULL COMMENT ''Direction du camion (ENTREE = charge, SORTIE = décharge)'' AFTER client',
    'SELECT ''Colonne direction existe déjà'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index pour améliorer les performances
-- Vérifier que les colonnes existent avant de créer les index

-- Index sur statut (seulement si la colonne existe)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'statut'
);

SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND INDEX_NAME = 'idx_pesages_statut'
);

SET @sql = IF(@col_exists > 0 AND @index_exists = 0,
    'CREATE INDEX idx_pesages_statut ON pesages(statut)',
    'SELECT ''Index idx_pesages_statut existe déjà ou colonne manquante'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index sur type_pesage (seulement si la colonne existe)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'type_pesage'
);

SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND INDEX_NAME = 'idx_pesages_type_pesage'
);

SET @sql = IF(@col_exists > 0 AND @index_exists = 0,
    'CREATE INDEX idx_pesages_type_pesage ON pesages(type_pesage)',
    'SELECT ''Index idx_pesages_type_pesage existe déjà ou colonne manquante'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index sur client (seulement si la colonne existe)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'client'
);

SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND INDEX_NAME = 'idx_pesages_client'
);

SET @sql = IF(@col_exists > 0 AND @index_exists = 0,
    'CREATE INDEX idx_pesages_client ON pesages(client)',
    'SELECT ''Index idx_pesages_client existe déjà ou colonne manquante'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ Migration terminée avec succès' AS resultat;

