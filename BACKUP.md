# Sauvegarde (backup) des données utilisateurs

## Type de stockage

- **Pas de base dédiée « backup »** : les sauvegardes sont des **fichiers** sur le disque.
- **Emplacement** : répertoire local (par défaut `data/backups/`), configurable via `BACKUP_DIR`.
- **Contenu d’un backup** : un **dossier horodaté** (ex. `2025-02-20T14-30-00`) contenant :
  - une **copie du fichier SQLite** (`mood.db`, et si présent `mood.db-wal`, `mood.db-shm`) ;
  - des **exports JSON** : `users.json`, `events.json`, `stats.json` (pour lecture/audit ou restauration ciblée).

Ce choix permet :
- de ne pas ajouter de SGBD ni de service externe ;
- des restaurations simples (copier le .db ou réimporter les JSON) ;
- une rétention automatique (suppression des dossiers trop vieux).

Pour une **durabilité renforcée**, vous pouvez ensuite :
- copier `data/backups/` vers un autre disque ou un stockage cloud (S3, GCS) via un script ou un cron ;
- ou remplacer `BACKUP_DIR` par un chemin monté (NFS, volume cloud).

---

## Côté app_server (Node.js)

### Module `server/backup.js`

- **runBackup()** : crée un sous-dossier dans `BACKUP_DIR`, copie la base SQLite (et WAL/shm si présents), exporte users/events/stats en JSON. Retourne `{ path, name, size, createdAt }`.
- **listBackups()** : liste les dossiers de backup (nom = date, taille), triés du plus récent au plus ancien.
- **pruneBackups(retentionDays)** : supprime les dossiers plus vieux que `retentionDays` (défaut : `BACKUP_RETENTION_DAYS` ou 30).

### Variables d’environnement

- `BACKUP_DIR` : répertoire des backups (défaut : `data/backups/` relatif au projet).
- `BACKUP_RETENTION_DAYS` : conservation en jours (défaut : 30).

### API (JWT requis)

- **GET /api/backup** : liste des backups + `retentionDays`.
- **POST /api/backup** : crée un backup puis applique la rétention ; retourne `{ ok, backup, pruned }`.

### Ligne de commande

```bash
npm run backup
```

Lance un backup puis le nettoyage selon la rétention. À planifier en cron si besoin (ex. tous les jours à 3h).

### Restauration

- **Remplacer la base** : arrêter l’app, copier `backups/<date>/mood.db` vers `data/mood.db`, redémarrer.
- **Réimporter une table** : utiliser les JSON du dossier de backup et un script qui fait des INSERT (ou ignorer les JSON et ne restaurer que le .db).

---

## Côté app Flutter (MOOD)

Pour que les données utilisateur soient **disponibles à sauvegarder** côté serveur, l’app envoie une copie au dashboard :

1. **Envoi vers le serveur** : après connexion (et à chaque changement pertinent), l’app envoie :
   - **POST /api/users** : `userId` (Firebase uid), `email` (ou displayName).
   - **POST /api/stats** : pour la journée courante, `userId`, `date`, `water`, `movements`, `goalsReached`.

2. **Où c’est fait** : un **service de sync** (`BackupSyncService`) appelle l’API du dashboard si une URL de base est configurée. L’app peut déclencher ce sync :
   - au login / au chargement du profil ;
   - après une mise à jour des données santé (eau, mouvements, objectifs).

3. **Configuration** : dans `lib/config/backup_config.dart`, définir l’URL de base du dashboard (ex. `http://10.0.2.2:3001` en dev Android, ou l’URL de prod). Si l’URL est vide, le sync est désactivé.

Résultat : le serveur reçoit et stocke les données dans SQLite ; les backups serveur (manuels ou cron) incluent donc bien les utilisateurs et leurs stats.

---

## Résumé du flux

1. **App** : utilisateur connecté → sync user + stats du jour vers le dashboard (POST /api/users, POST /api/stats).
2. **Serveur** : reçoit les données et les enregistre en SQLite.
3. **Backup serveur** : `POST /api/backup` ou `npm run backup` → copie de la base + exports JSON dans `data/backups/<date>/`.
4. **Rétention** : à chaque backup, suppression des dossiers plus vieux que `BACKUP_RETENTION_DAYS`.

Aucun « file manager » ni base dédiée aux backups : uniquement **fichiers dans un répertoire** + API et script CLI pour créer/lister/nettoyer.
