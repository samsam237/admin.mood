# MOOD — Dashboard Admin

Application web à part pour collecter les données et afficher le tableau de bord d’administration MOOD, avec un **outil d’aide à la décision** (insights, recommandations, sauvegarde utilisateur).

- **Stack** : Node.js (Express) + SQLite + React (Vite).
- **Rôle** : ingestion des données (API), stockage SQLite, affichage (vue d’ensemble, **Décision**, utilisateurs, événements, stats, export CSV), sauvegarde/restauration des données utilisateur.
- **Spécification outil décision** : voir [docs/DECISION_SUPPORT_SPEC.md](docs/DECISION_SUPPORT_SPEC.md).

---

## Prérequis

- Node.js 18+
- npm

---

## Installation

```bash
cd app_server
npm install
cd client && npm install && cd ..
```

---

## Premier lancement : créer l’admin et la base

Créer le fichier SQLite et le compte admin (à faire une fois) :

```bash
npm run init-db
```

Par défaut : **admin** / **admin123**. Pour changer, définir avant `init-db` :

- `ADMIN_USERNAME` et `ADMIN_PASSWORD` (dans un fichier `.env` à la racine de `app_server`, ou en variable d’environnement).

Exemple `.env` :

```
PORT=3001
JWT_SECRET=une-chaine-secrete-en-prod
DB_PATH=./data/mood.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## Données de test (optionnel)

Pour remplir la base avec des utilisateurs, événements et stats fictives (utile pour voir les courbes et les listes) :

```bash
npm run seed
```

---

## Lancer en développement

Terminal 1 — API (port 3001) :

```bash
npm run dev:server
```

Terminal 2 — Client (port 5173, proxy vers l’API) :

```bash
npm run dev:client
```

Puis ouvrir **http://localhost:5173** et se connecter avec admin / admin123.

Alternative en une commande (deux processus) :

```bash
npm run dev
```

---

## Lancer en production

```bash
npm run build
npm start
```

Ouvrir **http://localhost:3001**. Le serveur sert l’API et le front buildé.

---

## API d’ingestion (pour l’app MOOD)

Les routes suivantes acceptent des `POST` sans authentification (pour que l’app envoie les données).

### `POST /api/events`

Body JSON :

- `userId` (string) — obligatoire  
- `type` (string) — obligatoire  
- `payload` (object ou string) — optionnel  
- `timestamp` (ISO8601) — optionnel, défaut = maintenant  

### `POST /api/stats`

Body JSON :

- `userId` (string) — obligatoire  
- `date` (YYYY-MM-DD) — obligatoire  
- `water` (number) — optionnel  
- `movements` (number) — optionnel  
- `goalsReached` (boolean) — optionnel  

### `POST /api/users`

Body JSON :

- `userId` (string) — obligatoire  
- `email` (string) — optionnel  
- `createdAt` (ISO8601) — optionnel  

---

## Schéma SQLite

- **admins** : id, username, password_hash, created_at  
- **users** : id, user_id (unique), email, created_at, updated_at  
- **events** : id, user_id, type, payload (JSON string), timestamp, created_at  
- **stats** : id, user_id, date, water, movements, goals_reached, created_at — contrainte UNIQUE(user_id, date)  

---

## Structure du projet

```
app_server/
├── package.json          # scripts + deps serveur
├── server/
│   ├── index.js          # Express, CORS, routes, service static
│   ├── db.js             # SQLite + schéma
│   ├── init-db.js        # script création admin + tables
│   ├── auth.js           # JWT + login
│   └── routes/
│       ├── auth.js       # POST /api/auth/login
│       └── api.js        # POST events/stats/users, GET overview/users/events/stats, GET export/*
├── client/               # Vite + React
│   ├── src/
│   │   ├── App.jsx       # routes (login, layout, overview, users, events, stats)
│   │   ├── api.js        # appels API + export CSV
│   │   ├── Login.jsx
│   │   ├── Layout.jsx
│   │   ├── Overview.jsx
│   │   ├── Users.jsx
│   │   ├── Events.jsx
│   │   └── Stats.jsx
│   └── ...
└── data/                 # créé au run, contient mood.db
```

---

## Export CSV

Depuis les vues Utilisateurs, Événements ou Statistiques, le bouton **Exporter CSV** déclenche le téléchargement du fichier correspondant (authentification via token dans le header).
