import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getDanubeOverview, getStationDetail } from './src/services/hydrologyEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/overview', async (req, res) => {
    try {
      const force = req.query.refresh === '1';
      const data = await getDanubeOverview(force);
      res.json(data);
    } catch (err) {
      console.error('Error in /api/overview:', err);
      res.status(500).json({ error: 'Eroare la preluarea datelor hidrologice oficiale.' });
    }
  });

  app.get('/api/stations/:id', async (req, res) => {
    try {
      const detail = await getStationDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: 'Stația hidrometrică nu a fost găsită.' });
        return;
      }
      res.json(detail);
    } catch (err) {
      console.error('Error in /api/stations/:id:', err);
      res.status(500).json({ error: 'Eroare la calcularea prognozei și istoricului stației.' });
    }
  });

  // Real-time Server-Sent Events stream for Push Alert monitoring
  app.get('/api/alerts/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendLatestAlerts = async () => {
      try {
        const overview = await getDanubeOverview(false);
        const payload = JSON.stringify({
          observedDateLabel: overview.observedDateLabel,
          fetchedAt: overview.fetchedAt,
          alerts: overview.alerts,
        });
        res.write(`event: alerts\ndata: ${payload}\n\n`);
      } catch (err) {
        console.warn('SSE alert push check failed:', err);
      }
    };

    await sendLatestAlerts();
    const interval = setInterval(sendLatestAlerts, 60_000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HidroDunăre server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
