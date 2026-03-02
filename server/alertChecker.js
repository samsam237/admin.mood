import { getDb } from './db.js';

export function runAlertChecker() {
  const db = getDb();
  const hasUnread = (type) => db.prepare('SELECT 1 FROM alerts WHERE type = ? AND is_read = 0 LIMIT 1').get(type);

  if (!hasUnread('no_new_users')) {
    const count = db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at >= datetime('now', '-48 hours')").get().n;
    if (count === 0) {
      db.prepare('INSERT INTO alerts (type, message, threshold) VALUES (?, ?, ?)').run(
        'no_new_users',
        'Aucun nouvel utilisateur depuis 48 heures.',
        null
      );
    }
  }

  if (!hasUnread('low_retention')) {
    const cohort7 = db.prepare("SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-7 days')").get().n;
    const retained7 = cohort7 > 0 ? db.prepare(`
      SELECT COUNT(DISTINCT u.user_id) as n FROM users u
      WHERE date(u.created_at) <= date('now', '-7 days')
      AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.user_id AND date(e.timestamp) >= date(u.created_at) AND date(e.timestamp) <= date(u.created_at, '+7 days'))
    `).get().n : 0;
    const rate = cohort7 > 0 ? (retained7 / cohort7) * 100 : 0;
    if (rate < 30) {
      db.prepare('INSERT INTO alerts (type, message, threshold) VALUES (?, ?, ?)').run(
        'low_retention',
        `Taux de rétention D+7 sous 30% (actuel: ${Math.round(rate * 10) / 10}%).`,
        30
      );
    }
  }

  if (!hasUnread('no_activity')) {
    const count = db.prepare("SELECT COUNT(*) as n FROM events WHERE timestamp >= datetime('now', '-24 hours')").get().n;
    if (count === 0) {
      db.prepare('INSERT INTO alerts (type, message, threshold) VALUES (?, ?, ?)').run(
        'no_activity',
        'Aucun événement enregistré depuis 24 heures.',
        null
      );
    }
  }
}
