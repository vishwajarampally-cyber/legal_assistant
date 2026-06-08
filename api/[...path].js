import app from '../backend/index.js';

export default function handler(req, res) {
  // Vercel may route catch-all API paths with or without the /api prefix.
  // Ensure the Express app mounted at /api receives a consistent path.
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }
  return app(req, res);
}
