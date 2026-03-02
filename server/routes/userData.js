/**
 * Routes API pour les données utilisateur : sauvegarde, restauration, export, suppression.
 * Permet à l'utilisateur de sauvegarder ses données et de changer d'appareil sans perdre son historique.
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const DATA_DIR = process.env.USER_BACKUP_DIR || path.join(path.dirname(__dirname), '..', 'data', 'user_backups');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Middleware : vérifier un token utilisateur (X-User-Id ou Bearer avec user_id).
 */
function userTokenMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (userId) {
    req.userId = userId;
    return next();
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      req.userId = payload.user_id || payload.sub || payload.userId;
      if (req.userId) return next();
    } catch (_) {}
  }
  res.status(401).json({ error: 'Authentification utilisateur requise (X-User-Id ou Bearer avec user_id)' });
}

router.post('/backup', userTokenMiddleware, (req, res) => {
  try {
    const userId = req.userId || req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'userId requis' });

    const payload = req.body?.payload || req.body;
    const backupId = crypto.randomBytes(16).toString('hex');
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${userId}_${backupId}.json`);
    const content = JSON.stringify({
      userId,
      backupId,
      createdAt: new Date().toISOString(),
      version: 1,
      data: payload,
    });
    fs.writeFileSync(filePath, content, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    const db = getDb();
    db.prepare(`
      INSERT INTO user_backup_meta (user_id, backup_id, created_at, size_bytes, checksum)
      VALUES (?, ?, datetime('now'), ?, ?)
    `).run(userId, backupId, Buffer.byteLength(content, 'utf8'), checksum);

    res.status(201).json({
      ok: true,
      backupId,
      createdAt: new Date().toISOString(),
      size: Buffer.byteLength(content, 'utf8'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/backups', userTokenMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const db = getDb();
    const list = db.prepare(`
      SELECT backup_id, created_at, size_bytes FROM user_backup_meta
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(userId);
    res.json({ backups: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/backups/:backupId', userTokenMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { backupId } = req.params;
    const db = getDb();
    const row = db.prepare('SELECT user_id, backup_id FROM user_backup_meta WHERE backup_id = ? AND user_id = ?').get(backupId, userId);
    if (!row) return res.status(404).json({ error: 'Sauvegarde introuvable' });

    const filePath = path.join(DATA_DIR, `${userId}_${backupId}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier de sauvegarde introuvable' });

    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', userTokenMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const db = getDb();

    const user = db.prepare('SELECT user_id, email, created_at, updated_at FROM users WHERE user_id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const stats = db.prepare(`
      SELECT date, water, movements, goals_reached FROM stats WHERE user_id = ? ORDER BY date DESC LIMIT 365
    `).all(userId);
    const eventsCount = db.prepare('SELECT COUNT(*) as n FROM events WHERE user_id = ?').get(userId).n;
    const lastEvent = db.prepare('SELECT type, timestamp FROM events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1').get(userId);

    res.json({
      user: { userId: user.user_id, email: user.email, createdAt: user.created_at },
      stats,
      summary: {
        totalEvents: eventsCount,
        lastActivity: lastEvent?.timestamp || null,
        lastEventType: lastEvent?.type || null,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/me', userTokenMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const db = getDb();

    db.prepare('DELETE FROM events WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM stats WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM data_consent WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_backup_meta WHERE user_id = ?').run(userId);

    ensureDataDir();
    const backupFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith(userId + '_'));
    for (const f of backupFiles) {
      try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (_) {}
    }

    db.prepare(`
      INSERT INTO audit_log (actor_type, actor_id, action, resource, details)
      VALUES ('user', ?, 'delete_account', 'user_data', 'Data deletion request')
    `).run(userId);

    res.json({ ok: true, message: 'Données supprimées' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
