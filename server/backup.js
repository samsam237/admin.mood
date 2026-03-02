/**
 * Sauvegarde des données utilisateurs (SQLite + exports JSON).
 * Stockage : répertoire local (data/backups/) — un dossier par backup avec copie du .db et exports JSON.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb, DB_PATH } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups');
const RETENTION_DAYS = Math.max(0, parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30);

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Crée un backup : copie du fichier SQLite + exports JSON (users, events, stats) dans un sous-dossier horodaté.
 * @returns { { path: string, size: number, createdAt: string } }
 */
export function runBackup() {
  ensureBackupDir();
  const createdAt = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, createdAt);
  fs.mkdirSync(backupPath, { recursive: true });

  const dbFile = path.basename(DB_PATH);
  const destDb = path.join(backupPath, dbFile);
  fs.copyFileSync(DB_PATH, destDb);
  if (fs.existsSync(DB_PATH + '-wal')) {
    try { fs.copyFileSync(DB_PATH + '-wal', path.join(backupPath, dbFile + '-wal')); } catch (_) {}
  }
  if (fs.existsSync(DB_PATH + '-shm')) {
    try { fs.copyFileSync(DB_PATH + '-shm', path.join(backupPath, dbFile + '-shm')); } catch (_) {}
  }

  const db = getDb();
  const users = db.prepare('SELECT user_id, email, created_at, updated_at FROM users').all();
  const events = db.prepare('SELECT id, user_id, type, payload, timestamp FROM events ORDER BY timestamp DESC').all();
  const stats = db.prepare('SELECT user_id, date, water, movements, goals_reached FROM stats ORDER BY date DESC').all();
  fs.writeFileSync(path.join(backupPath, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupPath, 'events.json'), JSON.stringify(events, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupPath, 'stats.json'), JSON.stringify(stats, null, 2), 'utf8');

  let size = 0;
  for (const name of fs.readdirSync(backupPath)) {
    const stat = fs.statSync(path.join(backupPath, name));
    if (stat.isFile()) size += stat.size;
  }

  return { path: backupPath, name: createdAt, size, createdAt };
}

/**
 * Liste les backups (sous-dossiers de BACKUP_DIR), triés du plus récent au plus ancien.
 * @returns { Array<{ name: string, path: string, size: number, createdAt: string }> }
 */
export function listBackups() {
  ensureBackupDir();
  const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory());
  const result = [];
  for (const e of entries) {
    const dirPath = path.join(BACKUP_DIR, e.name);
    let size = 0;
    try {
      for (const f of fs.readdirSync(dirPath)) {
        const stat = fs.statSync(path.join(dirPath, f));
        if (stat.isFile()) size += stat.size;
      }
    } catch (_) {}
    result.push({ name: e.name, path: dirPath, size, createdAt: e.name });
  }
  result.sort((a, b) => b.name.localeCompare(a.name));
  return result;
}

/**
 * Supprime les backups plus vieux que retentionDays.
 * @param { number } retentionDays
 * @returns { number } nombre de dossiers supprimés
 */
export function pruneBackups(retentionDays = RETENTION_DAYS) {
  ensureBackupDir();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const e of fs.readdirSync(BACKUP_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dirPath = path.join(BACKUP_DIR, e.name);
    const stat = fs.statSync(dirPath);
    if (stat.mtimeMs < cutoff) {
      try {
        for (const f of fs.readdirSync(dirPath)) fs.unlinkSync(path.join(dirPath, f));
        fs.rmdirSync(dirPath);
        deleted++;
      } catch (_) {}
    }
  }
  return deleted;
}

export { BACKUP_DIR, RETENTION_DAYS };
