import app from '../backend/index.js';

export default function handler(req, res) {
  // Vercel routes /api/[...path] to this handler with req.url already containing
  // the full path (e.g. /api/documents, /api/evaluation/analytics).
  // Just pass through directly to the Express app which is mounted at /api.
  return app(req, res);
}
