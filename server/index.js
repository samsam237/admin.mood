import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import swaggerUi from 'swagger-ui-express';
import { getDb, initSchema } from './db.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import userDataRoutes from './routes/userData.js';
import { runAlertChecker } from './alertChecker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const db = getDb();
initSchema(db);

// Créer un admin par défaut si aucun n'existe (premier déploiement / volume vide)
function ensureDefaultAdmin() {
  const existing = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (existing) return;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log('Admin par défaut créé:', username, '(changez le mot de passe en prod)');
}
ensureDefaultAdmin();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Swagger / OpenAPI documentation
const openapiPath = path.join(__dirname, 'openapi.json');
let openapiDoc = null;
if (fs.existsSync(openapiPath)) {
  openapiDoc = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));
}

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/user-data', userDataRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
} else {
  app.get('/', (req, res) => {
    res.send('<p>Dashboard MOOD — lancez le client en dev (<code>cd client && npm run dev</code>) ou build puis redémarrez.</p>');
  });
}

runAlertChecker();
setInterval(runAlertChecker, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Dashboard MOOD: http://localhost:${PORT}`);
});
