import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
