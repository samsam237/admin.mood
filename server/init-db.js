import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb, initSchema } from './db.js';

const db = getDb();
initSchema(db);

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';
const hash = bcrypt.hashSync(password, 10);

const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
if (!existing) {
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log('Admin créé:', username);
} else {
  console.log('Admin existe déjà:', username);
}

console.log('Base SQLite initialisée.');
db.close();
