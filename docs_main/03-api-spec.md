# Spécification API — mood-admin

**Base URL** : `http://localhost:3001/api`  
**Format** : JSON (`Content-Type: application/json`)  
**Auth** : `Authorization: Bearer <jwt>` sur tous les endpoints sauf ceux marqués `[PUBLIC]`

---

## Auth

### POST `/api/auth/login`
`[PUBLIC]`

**Body**
```json
{ "username": "admin", "password": "changeme" }
```
**Réponse 200**
```json
{ "token": "<jwt>", "username": "admin" }
```
**Erreurs** : `401 Invalid credentials`

---

## Ingestion (app Flutter) `[PUBLIC]`

### POST `/api/users`
Enregistrer ou mettre à jour un utilisateur.

**Body**
```json
{ "userId": "firebase_uid_123", "email": "user@example.com" }
```
**Réponse 200** : `{ "ok": true }`

---

### POST `/api/events`
Envoyer un événement in-app.

**Body**
```json
{
  "userId": "firebase_uid_123",
  "type": "screen_view",
  "payload": { "screen": "home" },
  "timestamp": "2026-05-30T10:00:00Z"
}
```
`timestamp` est optionnel (défaut : maintenant).  
**Réponse 201** : `{ "ok": true }`

---

### POST `/api/stats`
Envoyer les stats journalières (idempotent par `userId + date`).

**Body**
```json
{
  "userId": "firebase_uid_123",
  "date": "2026-05-30",
  "water": 8,
  "movements": 45,
  "goalsReached": true
}
```
**Réponse 200** : `{ "ok": true }`

---

## Analytics

### GET `/api/overview`
Résumé global.

**Réponse 200**
```json
{
  "totalUsers": 1240,
  "totalEvents": 58420,
  "activeToday": 87,
  "newUsersToday": 12,
  "recentEvents": [
    { "type": "screen_view", "count": 342, "lastHour": 28 }
  ]
}
```

---

### GET `/api/kpis?days=30`
KPIs principaux.

**Query params** : `days` (7 | 14 | 30 | 60 | 90, défaut 30)

**Réponse 200**
```json
{
  "dau": { "value": 87, "trend": 5.2 },
  "wau": { "value": 312, "trend": -1.4 },
  "mau": { "value": 890, "trend": 8.1 },
  "stickiness": { "value": 9.8, "trend": 0.3 },
  "goalsRate": { "value": 67.4, "trend": 2.1 },
  "avgStreak": { "value": 4.2, "trend": 0.0 }
}
```
`trend` = variation en % par rapport à la période précédente.

---

### GET `/api/analytics?days=30`
Séries temporelles pour les graphiques.

**Réponse 200**
```json
{
  "dailyActiveUsers": [
    { "date": "2026-05-01", "count": 72 },
    { "date": "2026-05-02", "count": 80 }
  ],
  "dailyEvents": [
    { "date": "2026-05-01", "count": 1842 }
  ],
  "dailyWater": [
    { "date": "2026-05-01", "avg": 6.4 }
  ],
  "dailyMovements": [
    { "date": "2026-05-01", "avg": 38.2 }
  ]
}
```

---

### GET `/api/retention`
Taux de rétention par cohorte.

**Réponse 200**
```json
{
  "d1": 62.3,
  "d7": 41.8,
  "d30": 24.1
}
```

---

### GET `/api/events/trends?days=30`
Tendances par type d'événement (pour stacked bar chart).

**Réponse 200**
```json
[
  { "date": "2026-05-01", "screen_view": 120, "button_click": 84, "goal_reached": 32 }
]
```

---

## Utilisateurs

### GET `/api/users/segments`
Répartition des utilisateurs.

**Réponse 200**
```json
{
  "active": 312,
  "dormant": 198,
  "churned": 730
}
```
- **Active** : événement dans les 7 derniers jours
- **Dormant** : pas d'événement depuis 7 à 30 jours
- **Churned** : pas d'événement depuis > 30 jours

---

### GET `/api/users?page=1&limit=20&segment=active&q=john`
Liste paginée des utilisateurs.

**Query params** : `page`, `limit`, `segment` (active|dormant|churned), `q` (recherche email/userId)

**Réponse 200**
```json
{
  "data": [
    {
      "id": 1,
      "userId": "firebase_uid_123",
      "email": "john@example.com",
      "createdAt": "2026-01-15T08:00:00Z",
      "lastActiveAt": "2026-05-29T14:32:00Z",
      "eventCount": 342,
      "segment": "active"
    }
  ],
  "total": 1240,
  "page": 1,
  "limit": 20
}
```

---

### GET `/api/admin/users/:userId?days=30`
Détail d'un utilisateur.

**Réponse 200**
```json
{
  "user": {
    "userId": "firebase_uid_123",
    "email": "john@example.com",
    "createdAt": "2026-01-15T08:00:00Z"
  },
  "stats": {
    "totalEvents": 342,
    "totalDays": 87,
    "avgWater": 7.2,
    "avgMovements": 42.1,
    "goalsRate": 71.3
  },
  "history": [
    { "date": "2026-05-29", "water": 8, "movements": 45, "goalsReached": true }
  ],
  "recentEvents": [
    { "type": "screen_view", "timestamp": "2026-05-29T14:32:00Z" }
  ],
  "backups": [
    { "backupId": "abc123", "createdAt": "2026-05-20T10:00:00Z", "sizeBytes": 4096 }
  ]
}
```

---

## Événements & Stats

### GET `/api/events?page=1&limit=50&type=screen_view&userId=xxx&days=30`
Liste paginée d'événements.

**Réponse 200**
```json
{
  "data": [
    { "id": 1, "userId": "xxx", "type": "screen_view", "payload": {}, "timestamp": "..." }
  ],
  "total": 58420,
  "page": 1,
  "limit": 50
}
```

---

### GET `/api/stats?page=1&limit=50&days=30&userId=xxx`
Stats journalières paginées.

**Réponse 200**
```json
{
  "data": [
    { "userId": "xxx", "date": "2026-05-29", "water": 8, "movements": 45, "goalsReached": true }
  ],
  "total": 12000,
  "page": 1,
  "limit": 50
}
```

---

## Alertes

### GET `/api/alerts`
Alertes non lues.

**Réponse 200**
```json
[
  {
    "id": 1,
    "type": "low_retention",
    "message": "Rétention J7 à 18% — seuil de 30% non atteint",
    "threshold": 30,
    "triggeredAt": "2026-05-30T09:00:00Z",
    "isRead": false
  }
]
```

---

### PATCH `/api/alerts/:id/read`
Acquitter une alerte.

**Réponse 200** : `{ "ok": true }`

---

## Export CSV

### GET `/api/export/users`
**Réponse** : fichier `users.csv`
```
userId,email,createdAt,lastActiveAt,eventCount
```

### GET `/api/export/events?days=30&type=screen_view`
**Réponse** : fichier `events.csv`

### GET `/api/export/stats?days=30&userId=xxx`
**Réponse** : fichier `stats.csv`

### GET `/api/export/report`
**Réponse** : fichier `mood-report.csv` (multi-sections : overview, users, événements, stats)

---

## Données utilisateur (RGPD) `[APP AUTH]`

> Ces endpoints sont appelés par l'app Flutter avec l'identifiant utilisateur dans le header `X-User-Id`.

### POST `/api/user-data/backup`
Sauvegarder les données d'un utilisateur.

### GET `/api/user-data/backups`
Lister les sauvegardes d'un utilisateur.

### GET `/api/user-data/backups/:backupId`
Restaurer une sauvegarde.

### GET `/api/user-data/me`
Profil utilisateur + consentements.

### DELETE `/api/user-data/me`
Suppression totale (droit à l'oubli RGPD) — cascade sur events, stats, backups, consents.

---

## Health

### GET `/api/health`
`[PUBLIC]`

**Réponse 200**
```json
{
  "status": "ok",
  "db": "connected",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

## Codes d'erreur

| Code | Signification |
|---|---|
| 400 | Validation échouée (body invalide) |
| 401 | Token manquant ou expiré |
| 403 | Accès refusé (rôle insuffisant) |
| 404 | Ressource introuvable |
| 409 | Conflit (ex: userId déjà existant avec données différentes) |
| 500 | Erreur serveur interne |

**Format erreur** :
```json
{ "error": "Message descriptif", "code": "ERROR_CODE" }
```
