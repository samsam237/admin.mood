import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';
import { runBackup, listBackups, pruneBackups, RETENTION_DAYS } from '../backup.js';

const router = Router();
const db = getDb();

// --- Ingestion (publique pour que l'app MOOD puisse envoyer sans token) ---

router.post('/events', (req, res) => {
  try {
    const { userId, type, payload, timestamp } = req.body || {};
    if (!userId || !type) {
      return res.status(400).json({ error: 'userId et type requis' });
    }
    const ts = timestamp || new Date().toISOString();
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : (payload ?? '{}');
    db.prepare(
      'INSERT INTO events (user_id, type, payload, timestamp) VALUES (?, ?, ?, ?)'
    ).run(userId, type, payloadStr, ts);
    const row = db.prepare('SELECT last_insert_rowid() as id').get();
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/stats', (req, res) => {
  try {
    const { userId, date, water, movements, goalsReached } = req.body || {};
    if (!userId || !date) {
      return res.status(400).json({ error: 'userId et date requis' });
    }
    const w = Number(water) || 0;
    const m = Number(movements) || 0;
    const g = goalsReached === true || goalsReached === 1 ? 1 : 0;
    db.prepare(
      `INSERT INTO stats (user_id, date, water, movements, goals_reached) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET water=?, movements=?, goals_reached=?`
    ).run(userId, date, w, m, g, w, m, g);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { userId, email, createdAt } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }
    const now = new Date().toISOString();
    const created = createdAt || now;
    db.prepare(
      `INSERT INTO users (user_id, email, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, updated_at=?`
    ).run(userId, email ?? null, created, now, now);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Lecture (protégée admin) ---

router.get('/overview', authMiddleware, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const totalEvents = db.prepare('SELECT COUNT(*) as n FROM events').get().n;
    const recentEvents = db.prepare(`
      SELECT id, user_id, type, payload, timestamp
      FROM events ORDER BY timestamp DESC LIMIT 20
    `).all();
    res.json({
      totalUsers,
      totalEvents,
      recentEvents: recentEvents.map(e => ({
        ...e,
        payload: safeParse(e.payload),
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Séries temporelles pour les courbes d'analyse (30 derniers jours)
router.get('/analytics', authMiddleware, (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const dateMod = `-${days} days`;
    const eventsPerDay = db.prepare(`
      SELECT date(timestamp) as day, COUNT(*) as count
      FROM events WHERE timestamp >= date('now', ?)
      GROUP BY day ORDER BY day
    `).all(dateMod);
    const newUsersPerDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM users WHERE created_at >= date('now', ?)
      GROUP BY day ORDER BY day
    `).all(dateMod);
    const waterPerDay = db.prepare(`
      SELECT date as day, SUM(water) as total
      FROM stats WHERE date >= date('now', ?)
      GROUP BY date ORDER BY date
    `).all(dateMod);
    const movementsPerDay = db.prepare(`
      SELECT date as day, SUM(movements) as total
      FROM stats WHERE date >= date('now', ?)
      GROUP BY date ORDER BY date
    `).all(dateMod);
    res.json({
      eventsPerDay,
      newUsersPerDay,
      waterPerDay,
      movementsPerDay,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- KPIs (style Meta : acquisition / engagement) ---
router.get('/kpis', authMiddleware, (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30));
    const dateMod = `-${days} days`;

    const newUsersPeriod = db.prepare(`
      SELECT COUNT(*) as n FROM users WHERE created_at >= date('now', ?)
    `).get(dateMod).n;

    const dau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as n FROM events
      WHERE date(timestamp) = date('now')
    `).get().n;

    const wau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as n FROM events
      WHERE timestamp >= date('now', '-7 days')
    `).get().n;

    const mau = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as n FROM events
      WHERE timestamp >= date('now', '-30 days')
    `).get().n;

    const activeUsersPerDay = db.prepare(`
      SELECT date(timestamp) as day, COUNT(DISTINCT user_id) as count
      FROM events
      WHERE timestamp >= date('now', ?)
      GROUP BY day ORDER BY day
    `).all(dateMod);

    const stickinessPct = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;

    const goalStats = db.prepare(`
      SELECT COUNT(*) as total, SUM(goals_reached) as reached
      FROM stats WHERE date >= date('now', ?)
    `).get(dateMod);
    const goalAchievementPct = goalStats.total > 0
      ? Math.round((goalStats.reached / goalStats.total) * 1000) / 10
      : 0;

    const avgWater = db.prepare(`
      SELECT ROUND(AVG(water)) as avg FROM stats WHERE date >= date('now', ?)
    `).get(dateMod).avg ?? 0;

    const avgMovements = db.prepare(`
      SELECT ROUND(AVG(movements)) as avg FROM stats WHERE date >= date('now', ?)
    `).get(dateMod).avg ?? 0;

    res.json({
      days,
      newUsersPeriod,
      dau,
      wau,
      mau,
      stickinessPct,
      activeUsersPerDay,
      goalAchievementPct,
      avgWater: Math.round(avgWater),
      avgMovements: Math.round(avgMovements),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/users', authMiddleware, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const segment = (req.query.segment || '').toLowerCase();
    const q = req.query.q?.trim();
    let segmentWhere = '';
    if (segment === 'active') {
      segmentWhere = ` AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-7 days')`;
    } else if (segment === 'dormant') {
      segmentWhere = ` AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-7 days') AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-30 days')`;
    } else if (segment === 'churned') {
      segmentWhere = ` AND ((SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) IS NULL OR (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-30 days'))`;
    }
    let qWhere = '';
    const qParams = [];
    if (q) {
      qWhere = ' AND (u.user_id LIKE ? OR u.email LIKE ?)';
      const like = `%${q}%`;
      qParams.push(like, like);
    }

    const list = db.prepare(`
      SELECT u.user_id, u.email, u.created_at,
             (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) as last_activity
      FROM users u
      WHERE 1=1 ${segmentWhere} ${qWhere}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...qParams, limit, offset);
    const total = db.prepare(`
      SELECT COUNT(*) as n FROM users u WHERE 1=1 ${segmentWhere} ${qWhere}
    `).get(...qParams).n;
    res.json({ users: list, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/admin/users/:userId', authMiddleware, (req, res) => {
  try {
    const userId = req.params.userId;
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 90));
    const dateMod = `-${days} days`;

    const user = db.prepare('SELECT user_id, email, created_at, updated_at FROM users WHERE user_id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const lastActivity = db.prepare('SELECT MAX(timestamp) as ts FROM events WHERE user_id = ?').get(userId).ts;
    const eventCount = db.prepare('SELECT COUNT(*) as n FROM events WHERE user_id = ?').get(userId).n;

    const activeDaysInPeriod = db.prepare(`
      SELECT COUNT(DISTINCT date(timestamp)) as n
      FROM events
      WHERE user_id = ? AND timestamp >= date('now', ?)
    `).get(userId, dateMod).n;

    const recentEvents = db.prepare(`
      SELECT id, user_id, type, payload, timestamp
      FROM events
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(userId);

    const statsSeries = db.prepare(`
      SELECT date, water, movements, goals_reached
      FROM stats
      WHERE user_id = ? AND date >= date('now', ?)
      ORDER BY date DESC
      LIMIT 180
    `).all(userId, dateMod);

    const backups = db.prepare(`
      SELECT backup_id, created_at, size_bytes, checksum
      FROM user_backup_meta
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    res.json({
      user,
      days,
      lastActivity,
      eventCount,
      activeDaysInPeriod,
      recentEvents: recentEvents.map(e => ({ ...e, payload: safeParse(e.payload) })),
      statsSeries,
      backups,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/events', authMiddleware, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const type = req.query.type?.trim();
    const userId = req.query.userId?.trim();
    const days = req.query.days ? Math.min(365, Math.max(1, parseInt(req.query.days))) : null;
    let where = '1=1';
    const params = [];
    if (days) { params.push(`-${days} days`); where += ` AND timestamp >= date('now', ?)`; }
    if (type) { params.push(type); where += ' AND type = ?'; }
    if (userId) { params.push(userId); where += ' AND user_id = ?'; }
    params.push(limit, offset);
    const list = db.prepare(`
      SELECT id, user_id, type, payload, timestamp
      FROM events WHERE ${where}
      ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(...params);
    const countParams = [];
    if (days) countParams.push(`-${days} days`);
    if (type) countParams.push(type);
    if (userId) countParams.push(userId);
    const total = db.prepare(`SELECT COUNT(*) as n FROM events WHERE ${where}`).get(...countParams).n;
    res.json({
      events: list.map(e => ({ ...e, payload: safeParse(e.payload) })),
      total,
      page,
      limit,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', authMiddleware, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const days = req.query.days ? Math.min(365, Math.max(1, parseInt(req.query.days))) : null;
    const userId = req.query.userId?.trim();

    let where = '1=1';
    const params = [];
    if (userId) { params.push(userId); where += ' AND user_id = ?'; }
    if (days) { params.push(`-${days} days`); where += ` AND date >= date('now', ?)`; }

    const list = db.prepare(`
      SELECT user_id, date, water, movements, goals_reached, created_at
      FROM stats
      WHERE ${where}
      ORDER BY date DESC, user_id
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = db.prepare(`SELECT COUNT(*) as n FROM stats WHERE ${where}`).get(...params).n;
    res.json({ stats: list, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Retention (JWT protected) ---
router.get('/retention', authMiddleware, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const cohort1 = db.prepare(`
      SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-1 days')
    `).get().n;
    const retained1 = db.prepare(`
      SELECT COUNT(DISTINCT u.user_id) as n FROM users u
      WHERE date(u.created_at) <= date('now', '-1 days')
      AND EXISTS (
        SELECT 1 FROM events e WHERE e.user_id = u.user_id
        AND date(e.timestamp) >= date(u.created_at)
        AND date(e.timestamp) <= date(u.created_at, '+1 days')
      )
    `).get().n;
    const cohort7 = db.prepare(`
      SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-7 days')
    `).get().n;
    const retained7 = db.prepare(`
      SELECT COUNT(DISTINCT u.user_id) as n FROM users u
      WHERE date(u.created_at) <= date('now', '-7 days')
      AND EXISTS (
        SELECT 1 FROM events e WHERE e.user_id = u.user_id
        AND date(e.timestamp) >= date(u.created_at)
        AND date(e.timestamp) <= date(u.created_at, '+7 days')
      )
    `).get().n;
    const cohort30 = db.prepare(`
      SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-30 days')
    `).get().n;
    const retained30 = db.prepare(`
      SELECT COUNT(DISTINCT u.user_id) as n FROM users u
      WHERE date(u.created_at) <= date('now', '-30 days')
      AND EXISTS (
        SELECT 1 FROM events e WHERE e.user_id = u.user_id
        AND date(e.timestamp) >= date(u.created_at)
        AND date(e.timestamp) <= date(u.created_at, '+30 days')
      )
    `).get().n;
    const d1Rate = cohort1 > 0 ? Math.round((retained1 / cohort1) * 1000) / 10 : 0;
    const d7Rate = cohort7 > 0 ? Math.round((retained7 / cohort7) * 1000) / 10 : 0;
    const d30Rate = cohort30 > 0 ? Math.round((retained30 / cohort30) * 1000) / 10 : 0;

    const activeDaysRows = db.prepare(`
      SELECT user_id, COUNT(DISTINCT date(timestamp)) as active_days
      FROM events WHERE timestamp >= date('now', '-30 days')
      GROUP BY user_id
    `).all();
    const totalActiveDays = activeDaysRows.reduce((s, r) => s + r.active_days, 0);
    const avgActiveDays = totalUsers > 0 ? Math.round((totalActiveDays / totalUsers) * 10) / 10 : 0;

    const userDates = db.prepare(`
      SELECT user_id, date(timestamp) as d FROM events
      GROUP BY user_id, date(timestamp) ORDER BY user_id, d
    `).all();
    const streaksByUser = new Map();
    let currentUser = null;
    let streak = 0;
    let lastDate = null;
    for (const row of userDates) {
      const d = row.d;
      if (row.user_id !== currentUser) {
        if (currentUser != null && streak > 0) {
          const prev = streaksByUser.get(currentUser) || 0;
          streaksByUser.set(currentUser, Math.max(prev, streak));
        }
        currentUser = row.user_id;
        streak = 1;
        lastDate = d;
        continue;
      }
      const prevDay = new Date(lastDate);
      prevDay.setDate(prevDay.getDate() + 1);
      const expected = prevDay.toISOString().slice(0, 10);
      if (d === expected) {
        streak++;
      } else {
        const prev = streaksByUser.get(currentUser) || 0;
        streaksByUser.set(currentUser, Math.max(prev, streak));
        streak = 1;
      }
      lastDate = d;
    }
    if (currentUser != null && streak > 0) {
      const prev = streaksByUser.get(currentUser) || 0;
      streaksByUser.set(currentUser, Math.max(prev, streak));
    }
    const streakValues = [...streaksByUser.values()];
    const avgStreak = streakValues.length > 0
      ? Math.round((streakValues.reduce((a, b) => a + b, 0) / streakValues.length) * 10) / 10
      : 0;

    res.json({
      retentionD1: d1Rate,
      retentionD7: d7Rate,
      retentionD30: d30Rate,
      avgStreak,
      avgActiveDaysLast30: avgActiveDays,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- User segments (JWT protected) ---
router.get('/users/segments', authMiddleware, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const active = db.prepare(`
      SELECT COUNT(*) as n FROM users u
      WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-7 days')
    `).get().n;
    const dormant = db.prepare(`
      SELECT COUNT(*) as n FROM users u
      WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-7 days')
      AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-30 days')
    `).get().n;
    const churned = db.prepare(`
      SELECT COUNT(*) as n FROM users u
      WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) IS NULL
      OR (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-30 days')
    `).get().n;
    res.json({
      segments: [
        { id: 'active', label: 'Active', count: active, percentage: total > 0 ? Math.round((active / total) * 1000) / 10 : 0 },
        { id: 'dormant', label: 'Dormant', count: dormant, percentage: total > 0 ? Math.round((dormant / total) * 1000) / 10 : 0 },
        { id: 'churned', label: 'Churned', count: churned, percentage: total > 0 ? Math.round((churned / total) * 1000) / 10 : 0 },
      ],
      total,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Event trends (JWT protected) ---
router.get('/events/trends', authMiddleware, (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));
    const dateMod = `-${days} days`;
    const byDay = db.prepare(`
      SELECT date(timestamp) as day, type, COUNT(*) as count
      FROM events WHERE timestamp >= date('now', ?)
      GROUP BY date(timestamp), type ORDER BY day
    `).all(dateMod);
    const dates = [...new Set(byDay.map(r => r.day))].sort();
    const types = [...new Set(byDay.map(r => r.type))];
    const series = {};
    for (const t of types) series[t] = [];
    const map = new Map();
    for (const r of byDay) {
      if (!map.has(r.day)) map.set(r.day, {});
      map.get(r.day)[r.type] = r.count;
    }
    for (const d of dates) {
      const row = map.get(d) || {};
      for (const t of types) series[t].push(row[t] || 0);
    }
    res.json({ dates, series });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Alerts (JWT protected) ---
router.get('/alerts', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT id, type, message, threshold, triggered_at, is_read FROM alerts WHERE is_read = 0 ORDER BY triggered_at DESC').all();
    res.json({ alerts: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/alerts/:id/read', authMiddleware, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
    if (db.prepare('SELECT changes()').get()['changes()'] === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Backup (JWT protected) ---
router.get('/backup', authMiddleware, (req, res) => {
  try {
    const list = listBackups();
    res.json({ backups: list, retentionDays: RETENTION_DAYS });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/backup', authMiddleware, (req, res) => {
  try {
    const result = runBackup();
    const deleted = pruneBackups();
    res.status(201).json({ ok: true, backup: result, pruned: deleted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Sauvegardes utilisateurs (admin : liste de toutes les sauvegardes "Mes données") ---
router.get('/admin/user-backups', authMiddleware, (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const offset = parseInt(req.query.offset, 10) || 0;
    const list = db.prepare(`
      SELECT user_id, backup_id, created_at, size_bytes
      FROM user_backup_meta
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as n FROM user_backup_meta').get().n;
    res.json({ backups: list, total, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Export CSV (admin) ---

router.get('/export/users', authMiddleware, (req, res) => {
  try {
    const segment = (req.query.segment || '').toLowerCase();
    const q = req.query.q?.trim();
    let segmentWhere = '';
    if (segment === 'active') {
      segmentWhere = ` AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-7 days')`;
    } else if (segment === 'dormant') {
      segmentWhere = ` AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-7 days') AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-30 days')`;
    } else if (segment === 'churned') {
      segmentWhere = ` AND ((SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) IS NULL OR (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-30 days'))`;
    }
    let qWhere = '';
    const qParams = [];
    if (q) {
      qWhere = ' AND (u.user_id LIKE ? OR u.email LIKE ?)';
      const like = `%${q}%`;
      qParams.push(like, like);
    }
    const rows = db.prepare(`
      SELECT u.user_id, u.email, u.created_at,
             (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) as last_activity
      FROM users u
      WHERE 1=1 ${segmentWhere} ${qWhere}
      ORDER BY u.created_at DESC
    `).all(...qParams);
    const csv = ['user_id,email,created_at,last_activity', ...rows.map(r =>
      [r.user_id, escapeCsv(r.email), r.created_at, r.last_activity].join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/export/events', authMiddleware, (req, res) => {
  try {
    const type = req.query.type?.trim();
    const userId = req.query.userId?.trim();
    const days = req.query.days ? Math.min(365, Math.max(1, parseInt(req.query.days))) : null;
    let where = '1=1';
    const params = [];
    if (days) { params.push(`-${days} days`); where += ` AND timestamp >= date('now', ?)`; }
    if (type) { params.push(type); where += ' AND type = ?'; }
    if (userId) { params.push(userId); where += ' AND user_id = ?'; }
    const rows = db.prepare(`SELECT id, user_id, type, payload, timestamp FROM events WHERE ${where} ORDER BY timestamp DESC`).all(...params);
    const csv = ['id,user_id,type,payload,timestamp', ...rows.map(r =>
      [r.id, r.user_id, r.type, escapeCsv(r.payload), r.timestamp].join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=events.csv');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/export/stats', authMiddleware, (req, res) => {
  try {
    const days = req.query.days ? Math.min(365, Math.max(1, parseInt(req.query.days))) : null;
    let where = '';
    const params = [];
    if (days) {
      where = 'WHERE date >= date(\'now\', ?)';
      params.push(`-${days} days`);
    }
    const rows = db.prepare(`SELECT user_id, date, water, movements, goals_reached, created_at FROM stats ${where} ORDER BY date DESC`).all(...params);
    const csv = ['user_id,date,water,movements,goals_reached,created_at', ...rows.map(r =>
      [r.user_id, r.date, r.water, r.movements, r.goals_reached, r.created_at].join(',')
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=stats.csv');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/export/report', authMiddleware, (req, res) => {
  try {
    const retention = (() => {
      const cohort7 = db.prepare(`SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-7 days')`).get().n;
      const retained7 = db.prepare(`
        SELECT COUNT(DISTINCT u.user_id) as n FROM users u
        WHERE date(u.created_at) <= date('now', '-7 days')
        AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.user_id AND date(e.timestamp) >= date(u.created_at) AND date(e.timestamp) <= date(u.created_at, '+7 days'))
      `).get().n;
      const cohort30 = db.prepare(`SELECT COUNT(*) as n FROM users WHERE date(created_at) <= date('now', '-30 days')`).get().n;
      const retained30 = db.prepare(`
        SELECT COUNT(DISTINCT u.user_id) as n FROM users u
        WHERE date(u.created_at) <= date('now', '-30 days')
        AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.user_id AND date(e.timestamp) >= date(u.created_at) AND date(e.timestamp) <= date(u.created_at, '+30 days'))
      `).get().n;
      const totalUsers = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
      const activeDaysRows = db.prepare(`SELECT user_id, COUNT(DISTINCT date(timestamp)) as active_days FROM events WHERE timestamp >= date('now', '-30 days') GROUP BY user_id`).all();
      const avgActiveDays = totalUsers > 0 ? (activeDaysRows.reduce((s, r) => s + r.active_days, 0) / totalUsers).toFixed(2) : 0;
      const userDates = db.prepare(`SELECT user_id, date(timestamp) as d FROM events GROUP BY user_id, date(timestamp) ORDER BY user_id, d`).all();
      const streaksByUser = new Map();
      let cur = null, streak = 0, lastD = null;
      for (const row of userDates) {
        if (row.user_id !== cur) {
          if (cur != null && streak > 0) streaksByUser.set(cur, Math.max(streaksByUser.get(cur) || 0, streak));
          cur = row.user_id; streak = 1; lastD = row.d; continue;
        }
        const prev = new Date(lastD); prev.setDate(prev.getDate() + 1);
        if (row.d === prev.toISOString().slice(0, 10)) streak++; else { streaksByUser.set(cur, Math.max(streaksByUser.get(cur) || 0, streak)); streak = 1; }
        lastD = row.d;
      }
      if (cur != null && streak > 0) streaksByUser.set(cur, Math.max(streaksByUser.get(cur) || 0, streak));
      const vals = [...streaksByUser.values()];
      const avgStreak = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
      return { retentionD7: cohort7 > 0 ? ((retained7 / cohort7) * 100).toFixed(2) : 0, retentionD30: cohort30 > 0 ? ((retained30 / cohort30) * 100).toFixed(2) : 0, avgStreak, avgActiveDaysLast30: avgActiveDays };
    })();
    const seg = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users u WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-7 days')) as active,
        (SELECT COUNT(*) FROM users u WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-7 days') AND (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) >= datetime('now', '-30 days')) as dormant,
        (SELECT COUNT(*) FROM users u WHERE (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) IS NULL OR (SELECT MAX(timestamp) FROM events WHERE user_id = u.user_id) < datetime('now', '-30 days')) as churned
    `).get();
    const total = seg.active + seg.dormant + seg.churned;
    const topTypes = db.prepare(`SELECT type, COUNT(*) as c FROM events GROUP BY type ORDER BY c DESC LIMIT 5`).all();
    const dailyTotals = db.prepare(`SELECT date(timestamp) as day, COUNT(*) as count FROM events WHERE timestamp >= date('now', '-30 days') GROUP BY date(timestamp) ORDER BY day`).all();
    const lines = [
      'Section 1 - Retention KPIs',
      'retention_d7_pct,retention_d30_pct,avg_streak,avg_active_days_last_30',
      [retention.retentionD7, retention.retentionD30, retention.avgStreak, retention.avgActiveDaysLast30].join(','),
      '',
      'Section 2 - User segmentation',
      'segment,count,percentage',
      `Active,${seg.active},${total > 0 ? ((seg.active / total) * 100).toFixed(2) : 0}`,
      `Dormant,${seg.dormant},${total > 0 ? ((seg.dormant / total) * 100).toFixed(2) : 0}`,
      `Churned,${seg.churned},${total > 0 ? ((seg.churned / total) * 100).toFixed(2) : 0}`,
      '',
      'Section 3 - Top 5 event types',
      'type,count',
      ...topTypes.map(r => [escapeCsv(r.type), r.c].join(',')),
      '',
      'Section 4 - Daily event totals (last 30 days)',
      'date,count',
      ...dailyTotals.map(r => [r.day, r.count].join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.send('\uFEFF' + lines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Health check (JWT protected) ---
router.get('/health', authMiddleware, (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const eventCount = db.prepare('SELECT COUNT(*) as n FROM events').get().n;
    const alertCount = db.prepare('SELECT COUNT(*) as n FROM alerts WHERE is_read = 0').get().n;
    res.json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      db: 'ok',
      userCount,
      eventCount,
      alertCount,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

function safeParse(str) {
  if (str == null) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default router;
