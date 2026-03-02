/**
 * Script CLI pour lancer un backup manuel (ex. cron).
 * Usage: node server/run-backup.js
 */
import 'dotenv/config';
import { getDb, initSchema } from './db.js';
import { runBackup, pruneBackups, RETENTION_DAYS } from './backup.js';

const db = getDb();
initSchema(db);

const result = runBackup();
console.log('Backup créé:', result.name, '(', Math.round(result.size / 1024), 'KB)');
const deleted = pruneBackups(RETENTION_DAYS);
if (deleted > 0) console.log('Anciens backups supprimés:', deleted, '(rétention', RETENTION_DAYS, 'jours)');
db.close();
