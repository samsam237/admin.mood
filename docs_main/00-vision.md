# Vision & Périmètre — mood-admin

## Problème résolu

L'application mobile MOOD (santé & bien-être) génère des événements et des statistiques journalières. Les administrateurs n'ont aucun outil moderne pour piloter les KPIs métier (rétention, engagement, objectifs atteints), détecter les anomalies ou exporter des données. La version précédente (`admin.mood`) utilisait SQLite, n'avait pas de typage, et son UI manquait de professionnalisme.

---

## Objectifs du projet

| Priorité | Objectif |
|---|---|
| P0 | Dashboard analytics en temps quasi-réel (KPIs, rétention, segmentation) |
| P0 | Ingestion fiable des événements depuis l'app Flutter |
| P1 | Système d'alertes automatiques sur les anomalies |
| P1 | Export CSV des données brutes et rapports |
| P2 | Gestion RGPD (suppression de compte, export données utilisateur) |
| P2 | Sauvegardes des données utilisateurs |

---

## Ce que ce projet N'est PAS

- Pas un système temps-réel (WebSocket) — le polling est suffisant
- Pas une plateforme multi-tenant — un seul admin
- Pas un remplaçant de Mixpanel/Amplitude — outil interne léger

---

## Utilisateurs cibles

**Admin** (unique) : équipe technique ou fondateur, accède au dashboard via navigateur web.

**App Flutter** : client sans interface, envoie des événements et stats via API publique.

---

## User stories

### Authentification
- En tant qu'admin, je veux me connecter avec email + mot de passe pour accéder au dashboard.
- En tant qu'admin, je veux rester connecté 7 jours sans me reconnecter.

### Dashboard Overview
- En tant qu'admin, je veux voir DAU / WAU / MAU avec leur tendance.
- En tant qu'admin, je veux voir le taux de stickiness (DAU/MAU).
- En tant qu'admin, je veux voir le taux d'objectifs atteints aujourd'hui.
- En tant qu'admin, je veux changer la plage temporelle (7 / 14 / 30 / 60 / 90 jours).

### Rétention
- En tant qu'admin, je veux voir les taux de rétention J1, J7, J30 par cohorte.
- En tant qu'admin, je veux voir les tendances d'événements par type sur N jours.

### Utilisateurs
- En tant qu'admin, je veux voir la liste paginée des utilisateurs avec leur statut.
- En tant qu'admin, je veux filtrer les utilisateurs (Actif / Dormant / Churné).
- En tant qu'admin, je veux rechercher un utilisateur par email ou ID.
- En tant qu'admin, je veux voir le détail d'un utilisateur (historique, stats, sauvegardes).

### Événements & Stats
- En tant qu'admin, je veux lister les événements avec filtres (type, userId, date).
- En tant qu'admin, je veux voir les stats journalières (eau, mouvements, objectifs).

### Alertes
- En tant qu'admin, je veux être alerté si aucun nouvel utilisateur depuis 48h.
- En tant qu'admin, je veux être alerté si la rétention J7 est sous 30%.
- En tant qu'admin, je veux être alerté si aucune activité depuis 24h.
- En tant qu'admin, je veux acquitter une alerte une fois traitée.

### Export
- En tant qu'admin, je veux exporter les utilisateurs, événements ou stats en CSV.
- En tant qu'admin, je veux générer un rapport complet en un clic.

### RGPD
- En tant qu'utilisateur app, je veux que mes données soient supprimées sur demande.
- En tant qu'utilisateur app, je veux sauvegarder / restaurer mes données.

---

## Critères d'acceptation globaux

- [ ] Login fonctionnel avec redirection post-auth
- [ ] Dashboard charge en < 2s (plage 30 jours)
- [ ] KPIs corrects (DAU = users uniques actifs sur 24h)
- [ ] Rétention calculée par cohorte (date d'inscription)
- [ ] Alertes générées automatiquement sans intervention manuelle
- [ ] Export CSV valide et ouvrable dans Excel
- [ ] Suppression RGPD efface toutes les données de l'utilisateur
- [ ] UI responsive (desktop en priorité, tablet acceptable)
- [ ] Pas de donnée sensible loggée côté serveur
