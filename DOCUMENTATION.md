# Documentation complète — Dashboard MOOD (app_server)

Ce document décrit ce qui a été réalisé, comment les services sont organisés et comment ils communiquent entre eux.

---

## 1. Vue d’ensemble du projet

### 1.1 Objectif

Une **application web à part** (indépendante de l’app Flutter MOOD) qui :

1. **Reçoit et stocke** les données envoyées par l’app MOOD (ou par d’autres clients) via une API HTTP.
2. **Affiche un tableau de bord** réservé aux administrateurs : vue d’ensemble, listes (utilisateurs, événements, statistiques), export CSV.

Aucun code Flutter dans ce projet : c’est une app **full JavaScript** (Node.js + React).

### 1.2 Stack technique

| Couche        | Technologie        | Rôle |
|---------------|--------------------|------|
| Backend       | Node.js (Express)  | API REST, authentification, lecture/écriture SQLite |
| Base de données | SQLite (better-sqlite3) | Persistance : utilisateurs, événements, stats, admins |
| Frontend      | React (Vite)       | Interface admin : login, vues, export |
| Auth          | JWT + bcrypt       | Connexion admin, protection des routes de lecture |

---

## 2. Architecture globale

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    APP MOOD (Flutter)                    │
                    │  Envoie : POST /api/events, /api/stats, /api/users       │
                    └───────────────────────────┬─────────────────────────────┘
                                                │
                                                │ HTTP (JSON)
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVEUR EXPRESS (port 3001)                               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐   │
│  │ CORS        │   │ express.json│   │ /api/auth/*  │   │ /api/* (events, stats,  │   │
│  │             │   │             │   │ → login     │   │  users, overview,       │   │
│  │             │   │             │   │             │   │  export/*)                │   │
│  └─────────────┘   └─────────────┘   └─────────────┘   └───────────┬─────────────┘   │
│                                                                       │                 │
│                                                                       │ authMiddleware  │
│                                                                       │ (JWT) sur GET   │
│                                                                       ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SQLite (fichier data/mood.db)                       │   │
│  │   admins | users | events | stats                                                │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────────┘
                                                ▲
                                                │ HTTP (JSON + Bearer token)
                                                │
                    ┌───────────────────────────┴─────────────────────────────┐
                    │              CLIENT REACT (port 5173 en dev)            │
                    │  Login → token en localStorage → requêtes avec          │
                    │  Authorization: Bearer <token>                           │
                    └────────────────────────────────────────────────────────┘
```

En **développement** : le client tourne sur le port 5173 (Vite) et envoie toutes les requêtes vers `/api`, qui sont **proxifiées** par Vite vers `http://localhost:3001`. Ainsi, le navigateur parle toujours au même origine (5173), et c’est Vite qui redirige `/api` vers le serveur.

En **production** : après `npm run build`, le serveur sert à la fois les fichiers statiques du client (dossier `client/dist`) et l’API sur le port 3001. Une seule origine.

---

## 3. Communication entre les services

### 3.1 Qui parle à qui ?

| Émetteur              | Récepteur        | Protocole        | Quand |
|-----------------------|------------------|------------------|------|
| App MOOD (Flutter)    | Serveur Express  | HTTP POST, JSON  | Envoi d’événements, stats, users |
| Navigateur (React)    | Serveur Express  | HTTP GET/POST, JSON | Login, chargement des vues, export CSV |
| Serveur Express       | SQLite           | better-sqlite3 (synchrone) | À chaque requête API qui lit ou écrit des données |

Il n’y a **pas** de communication directe entre le client React et SQLite : tout passe par l’API Express.

### 3.2 Types de routes API

- **Publiques (sans token)** : réservées à l’**ingestion** des données. L’app MOOD n’a pas de token admin ; elle envoie simplement des POST.
  - `POST /api/events`
  - `POST /api/stats`
  - `POST /api/users`

- **Protégées (token JWT requis)** : utilisées par le **dashboard** (client React). Le client envoie l’en-tête `Authorization: Bearer <token>`.
  - `GET /api/overview`
  - `GET /api/users`
  - `GET /api/events`
  - `GET /api/stats`
  - `GET /api/export/users`
  - `GET /api/export/events`
  - `GET /api/export/stats`

- **Auth** :
  - `POST /api/auth/login` : public ; renvoie un JWT si identifiants valides.

### 3.3 Flux d’authentification admin

1. L’utilisateur ouvre le dashboard et arrive sur `/login`.
2. Il saisit identifiant et mot de passe, le client envoie `POST /api/auth/login` avec `{ username, password }`.
3. Le serveur vérifie dans la table `admins` (mot de passe hashé avec bcrypt). Si OK, il renvoie `{ username, token }` où `token` est un JWT signé avec `JWT_SECRET`.
4. Le client stocke le token dans `localStorage` et redirige vers la vue d’ensemble.
5. Pour toute requête vers une route protégée, le client lit le token et envoie `Authorization: Bearer <token>`.
6. Le serveur applique `authMiddleware` : il vérifie le JWT ; si invalide ou expiré, renvoie 401. Sinon, la route s’exécute (lecture SQLite, réponse JSON ou CSV).
7. Déconnexion : le client supprime le token du `localStorage` et redirige vers `/login`.

### 3.4 Flux de données (ingestion)

1. L’app MOOD (ou un script) envoie par exemple `POST /api/events` avec un body JSON.
2. Le serveur valide les champs obligatoires (`userId`, `type`), insère une ligne dans la table `events`, renvoie `201 { ok: true, id }`.
3. Aucun token n’est nécessaire. Les données sont **écrites** dans SQLite par le serveur.

### 3.5 Flux de données (lecture dashboard)

1. L’utilisateur est connecté (token en localStorage).
2. Une page (ex. Vue d’ensemble) appelle par exemple `getOverview()` dans `api.js`, qui fait `GET /api/overview` avec le header `Authorization: Bearer <token>`.
3. Le serveur exécute `authMiddleware` : si le token est valide, il exécute la route qui lit SQLite (agrégations, dernières lignes, etc.) et renvoie du JSON.
4. Le client React reçoit les données et les affiche (tableaux, cartes, graphiques).

### 3.6 Export CSV

1. L’utilisateur clique sur « Exporter CSV » (par exemple sur la vue Utilisateurs).
2. Le client appelle `exportCsv('users')`, qui fait `GET /api/export/users` avec le header `Authorization: Bearer <token>`.
3. Le serveur vérifie le JWT, lit toutes les lignes concernées en SQLite, génère un CSV en mémoire, renvoie le corps avec les headers `Content-Type: text/csv` et `Content-Disposition: attachment; filename=users.csv`.
4. Le client reçoit la réponse en blob, crée un lien de téléchargement temporaire et déclenche le clic pour sauvegarder le fichier.

---

## 4. Backend en détail

### 4.1 Point d’entrée : `server/index.js`

- Charge les variables d’environnement (`dotenv/config`).
- Crée l’app Express, active CORS et le parsing JSON.
- Ouvre la connexion SQLite et initialise le schéma (tables) au démarrage.
- Monte les routeurs :
  - ` /api/auth` → `authRoutes` (login).
  - ` /api` → `apiRoutes` (events, stats, users, overview, export, kpis, retention).
  - ` /api/user-data` → `userDataRoutes` (backup, backups list, me, delete).
- Si le dossier `client/dist` existe, sert les fichiers statiques et la route catch-all pour le SPA (React Router). Sinon, une simple page d’info sur `/`.
- Écoute sur le port `PORT` (défaut 3001).

### 4.2 Base de données : `server/db.js`

- **getDb()** : crée le dossier du fichier SQLite si besoin, ouvre une connexion better-sqlite3, active le mode WAL, renvoie l’instance. Le chemin est `process.env.DB_PATH` ou `./data/mood.db`.
- **initSchema(db)** : exécute les `CREATE TABLE IF NOT EXISTS` et les index pour :
  - **admins** : id, username, password_hash, created_at.
  - **users** : id, user_id (unique), email, created_at, updated_at.
  - **events** : id, user_id, type, payload (TEXT/JSON), timestamp, created_at.
  - **stats** : id, user_id, date, water, movements, goals_reached, created_at, avec UNIQUE(user_id, date).
- **data_consent** : consentement utilisateur (user_id, scope, version, accepted_at).
- **user_backup_meta** : métadonnées des sauvegardes utilisateur (user_id, backup_id, created_at, size_bytes, checksum).
- **audit_log** : log d’audit (actor_type, actor_id, action, resource, details, created_at).

Le même fichier DB est utilisé pour toutes les requêtes. Les écritures sont synchrones (better-sqlite3).

### 4.3 Auth : `server/auth.js`

- **createToken(username)** : signe un JWT avec `JWT_SECRET`, expiration 7 jours.
- **verifyToken(token)** : décode et vérifie le JWT ; renvoie le payload ou null.
- **authMiddleware(req, res, next)** : lit `Authorization: Bearer <token>`, appelle `verifyToken` ; si invalide, renvoie 401 ; sinon attache le payload à `req.admin` et appelle `next()`.
- **login(username, password)** : cherche l’admin en base, compare le mot de passe avec bcrypt ; si OK, renvoie `{ username, token }`, sinon null.

### 4.4 Routes auth : `server/routes/auth.js`

- **POST /api/auth/login** : lit `username` et `password` du body, appelle `login()` ; si échec, 401 avec message ; si succès, 200 avec `{ username, token }`.

### 4.5 Routes API : `server/routes/api.js`

- **POST /api/events** : body `userId`, `type`, optionnellement `payload`, `timestamp`. Insert dans `events`, renvoie 201 et l’id.
- **POST /api/stats** : body `userId`, `date`, optionnellement `water`, `movements`, `goalsReached`. Insert ou mise à jour (UPSERT) dans `stats`, renvoie 201.
- **POST /api/users** : body `userId`, optionnellement `email`, `createdAt`. Insert ou mise à jour dans `users`, renvoie 201.
- **GET /api/overview** (protégé) : agrège nombre d’utilisateurs, nombre d’événements, 20 derniers événements. Réponse JSON.
- **GET /api/users** (protégé) : pagination `page`, `limit` ; renvoie la liste des users avec dernière activité.
- **GET /api/events** (protégé) : pagination + filtres optionnels `type`, `userId` ; renvoie la liste des événements.
- **GET /api/stats** (protégé) : pagination ; renvoie la liste des stats.
- **GET /api/export/users** (protégé) : renvoie tout le contenu des users en CSV.
- **GET /api/export/events** (protégé) : idem pour events.
- **GET /api/export/stats** (protégé) : idem pour stats.

Les routes GET et export utilisent toutes le `authMiddleware` : sans token valide, 401.

---

## 5. Frontend en détail

### 5.1 Point d’entrée et routage

- **client/index.html** : charge `src/main.jsx`.
- **main.jsx** : rend `<App />` dans la div `#root`.
- **App.jsx** : définit les routes React Router :
  - `/login` → composant `Login` (pas de layout).
  - `/` → composant `Protected` qui vérifie la présence du token ; si absent, redirection vers `/login` ; sinon rend `Layout` avec un `Outlet` pour les sous-routes.
  - Sous-routes de `/` : index → `Overview`, `users` → `Users`, `users/:userId` → `UserDetail`, `user-backups` → `UserBackups`, `events` → `Events`, `stats` → `Stats`.
  - Toute autre path → redirection vers `/`.

### 5.2 Couche API client : `client/src/api.js`

- Constante `API = '/api'` : en dev, le proxy Vite envoie ces requêtes au serveur (3001).
- **getToken()** : lit `localStorage.getItem('token')`.
- **headers(useAuth)** : renvoie un objet d’en-têtes avec `Content-Type: application/json` et, si `useAuth` et token présent, `Authorization: Bearer <token>`.
- **login(username, password)** : POST vers `/api/auth/login` sans auth, parse la réponse, lance une erreur si non OK, sinon renvoie les données (dont `token`).
- **getOverview()**, **getUsers(page, limit)**, **getEvents(page, limit, filters)**, **getStats(page, limit)** : GET vers les routes correspondantes avec `headers()` (donc avec token). En cas de 401, lance une erreur avec message `'auth'` (pour redirection login si besoin). Sinon parse le JSON et le renvoie.
- **exportCsv(type)** : GET vers `/api/export/<type>` avec token, récupère la réponse en blob, crée un lien de téléchargement avec `download=<type>.csv` et déclenche le clic.
- **logout()** : supprime le token du localStorage et redirige vers `/` (puis Protected renverra vers `/login`).

### 5.3 Pages et données

| Page / composant | Rôle | Appels API |
|------------------|------|------------|
| **Login**        | Formulaire login/mot de passe ; envoie POST login, stocke le token, redirige vers `/`. | `login()` |
| **Layout**       | En-tête avec titre, liens (Vue d’ensemble, Utilisateurs, Événements, Statistiques), bouton Déconnexion ; rend `<Outlet />` pour le contenu de la route courante. | `logout()` au clic |
| **Overview**     | Cartes KPIs (utilisateurs, événements, DAU/WAU/MAU, rétention), courbes d’analyse, sauvegardes, tableau des 20 derniers événements. | `getOverview()`, `getAnalytics()`, `getKpis()`, `getRetention()`, `getBackupList()` |
| **Users**        | Tableau paginé (user_id, email, created_at, last_activity), bouton Exporter CSV. | `getUsers(page, limit)`, `exportCsv('users')` |
| **Events**       | Filtres type et userId, tableau paginé des événements, bouton Exporter CSV. | `getEvents(page, limit, filters)`, `exportCsv('events')` |
| **Stats**        | Tableau paginé (user_id, date, water, movements, goals_reached), bouton Exporter CSV. | `getStats(page, limit)`, `exportCsv('stats')` |

Chaque page qui charge des données fait un `useEffect` au montage (et selon les dépendances : page, filtres), appelle la fonction API correspondante, gère loading/error et met à jour l’état pour afficher le contenu ou un message d’erreur.

---

## 6. Schéma de la base SQLite

```
admins
  id (PK)
  username (UNIQUE)
  password_hash
  created_at

users
  id (PK)
  user_id (UNIQUE)   -- identifiant côté app MOOD (ex. Firebase uid)
  email
  created_at
  updated_at

events
  id (PK)
  user_id
  type               -- ex. "login", "water_add", "goal_reached"
  payload            -- JSON en texte
  timestamp
  created_at
  (index sur user_id, type, timestamp)

stats
  id (PK)
  user_id
  date               -- YYYY-MM-DD
  water
  movements
  goals_reached
  created_at
  UNIQUE(user_id, date)
  (index sur user_id, date)
```

---

## 7. Résumé des flux

- **App MOOD → Serveur** : POST publics vers `/api/events`, `/api/stats`, `/api/users` pour alimenter la base.
- **Navigateur (admin)** : POST `/api/auth/login` pour obtenir un JWT, puis GET (et export) avec `Authorization: Bearer <token>` pour lire les données et exporter en CSV.
- **Serveur ↔ SQLite** : à chaque requête d’ingestion ou de lecture, le serveur utilise la même connexion SQLite (module `db.js`) pour lire/écrire. Pas de cache intermédiaire : les données affichées sont toujours celles en base au moment de la requête.

Ce document couvre l’ensemble de ce qui a été fait et la façon dont les services communiquent. Pour l’installation et les commandes, voir le **README.md** du même dossier.
