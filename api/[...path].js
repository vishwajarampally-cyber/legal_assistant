import app from '../backend/index.js';

export default function handler(req, res) {
  // All /api/* routes come here via vercel.json routes config.
  // req.url will be the full path like /api/documents or /api/evaluation/analytics.
  // Express has app.use('/api', apiRouter) which strips /api automatically.
  // The root /health check is mounted directly on app (not under /api),
  // so we remap /api/health → /health.
  if (req.url === '/api/health' || req.url?.startsWith('/api/health?')) {
    req.url = req.url.replace('/api/health', '/health');
  }
  return app(req, res);
}
