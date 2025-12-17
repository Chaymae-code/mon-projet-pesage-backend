# Guide : Transfert Automatique vers Base Historique

## 📋 Vue d'ensemble

Le système transfère automatiquement les pesées terminées (COMPLETED) de la base opérationnelle (`pesage_operational`) vers la base historique raffinée (`pesage_data`).

## 🗄️ Structure des Bases

### Base Opérationnelle (`pesage_operational`)
- Table `active_weighings` : Pesées en cours
- États : ARRIVAL → ENTRY_WEIGHING → LOADING/UNLOADING → EXIT_WEIGHING → **COMPLETED**

### Base Historique (`pesage_data`)
- Table `pesages` : Pesées finalisées
- Tables liées : `matricules`, `clients`, `produits`, `chauffeurs`

## ⚙️ Configuration

### 1. Créer la base `pesage_data`

```sql
CREATE DATABASE IF NOT EXISTS pesage_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Importer le fichier SQL

```bash
mysql -u root -p pesage_data < PESAGE_data.sql
```

### 3. Configurer le fichier `.env`

Ajoutez la variable pour la base historique :

```env
# Base de données historique (nouvelle base raffinée)
DB_HISTORICAL_NAME=pesage_data
```

Les autres variables (DB_HOST, DB_USER, DB_PASSWORD, DB_PORT) sont partagées avec la base opérationnelle.

## 🔄 Fonctionnement Automatique

### Quand le transfert se déclenche

Le transfert se déclenche automatiquement quand :
1. Un pesage passe à l'état `COMPLETED`
2. Les poids (tare, brut, net) sont calculés
3. Le ticket est généré

### Processus de transfert

1. **Récupération du pesage** depuis `active_weighings`
2. **Création/Récupération des entités** :
   - Matricule (table `matricules`)
   - Client (table `clients`)
   - Produit (table `produits`)
3. **Insertion dans `pesages`** avec toutes les relations

### Gestion des doublons

Le système vérifie si un pesage avec le même ticket existe déjà pour éviter les doublons.

## 📊 Mapping des Données

| Base Opérationnelle | Base Historique |
|---------------------|-----------------|
| `matricule` (string) | `matricule_id` (int) via table `matricules` |
| `client_name` (string) | `client_id` (int) via table `clients` |
| `id_produit` (int) | `produit_id` (int) via table `produits` |
| `tare`, `brut`, `net` | `tare`, `brut`, `net` |
| `ticket_number` | `ticket` |
| `completion_time` | `date`, `heure` |

## 🔍 Vérification

### Vérifier qu'un pesage a été transféré

```sql
SELECT * FROM pesage_data.pesages WHERE ticket = 'TKT-XXXXX-XX';
```

### Vérifier les logs

Les logs du backend indiquent :
- ✅ `Transfert historique réussi` : Transfert OK
- ⚠️ `Échec transfert historique` : Erreur (détails dans les logs)
- ❌ `Erreur transfert historique` : Exception

## 🛠️ Dépannage

### Erreur : "Base historique non accessible"

1. Vérifiez que la base `pesage_data` existe
2. Vérifiez les identifiants dans `.env`
3. Vérifiez que le fichier `PESAGE_data.sql` a été importé

### Erreur : "Impossible de créer/récupérer le matricule"

1. Vérifiez que la table `matricules` existe
2. Vérifiez que la table `clients` existe (requis pour créer un matricule)

### Pesage non transféré

1. Vérifiez que le pesage est bien en état `COMPLETED`
2. Vérifiez que les poids (tare, brut, net) sont présents
3. Vérifiez les logs du backend pour les erreurs

## 📝 Notes

- Le transfert est **asynchrone** : il ne bloque pas la réponse API
- Les erreurs de transfert sont loggées mais n'empêchent pas la finalisation du pesage
- Le système crée automatiquement les entités manquantes (matricule, client, produit)


