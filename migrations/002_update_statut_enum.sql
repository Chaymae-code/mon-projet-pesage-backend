-- ============================================
-- MIGRATION : Mise à jour de l'ENUM statut
-- ============================================
-- Ajoute les nouvelles valeurs de statut pour le processus industriel

-- Vérifier si la colonne statut existe
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'pesages' 
    AND COLUMN_NAME = 'statut'
);

-- Si la colonne existe, modifier l'ENUM pour inclure toutes les valeurs
SET @sql = IF(@col_exists > 0,
    'ALTER TABLE pesages MODIFY COLUMN statut ENUM(''EN_ATTENTE'', ''PREMIER_MESURE'', ''EN_ZONE'', ''DEUXIEME_MESURE'', ''TARE_MESUREE'', ''BRUT_MESURE'', ''COMPLET'', ''ANNULE'') DEFAULT ''EN_ATTENTE'' COMMENT ''Statut du pesage dans la séquence industrielle''',
    'SELECT ''Colonne statut n''''existe pas'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 002 terminée : ENUM statut mis à jour' AS resultat;




