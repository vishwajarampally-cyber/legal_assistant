import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './src/routes/api.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { LangSmithService } from './src/services/langsmithService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Setup CORS middleware for frontend connection (highly flexible for dev and vercel)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Payload size limitations for handling large files safely
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Simple health check route
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'online',
    message: 'Simple Naive RAG backend is running optimally.',
    timestamp: new Date().toISOString(),
    langsmith: LangSmithService.getStatus(),
  });
});

// Mount modular endpoints
app.use('/api', apiRouter);

// Global error catcher
app.use(errorHandler);

// Only listen directly to port if not running as a Vercel Serverless Function
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const maxRetries = 5;
  async function startServer(port, attempt = 0) {
    try {
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`[SERVER ACTIVE] Running on port ${port}`);
        console.log(`- Health Check: http://127.0.0.1:${port}/health`);
        console.log(`- API Routes: http://127.0.0.1:${port}/api/*`);
      });

      server.on('error', async (err) => {
        if (err && err.code === 'EADDRINUSE') {
          if (attempt < maxRetries) {
            const nextPort = Number(port) + 1;
            console.warn(`[PORT IN USE] Port ${port} is in use, trying ${nextPort} (attempt ${attempt + 1}/${maxRetries})`);
            server.close?.();
            await startServer(nextPort, attempt + 1);
          } else {
            console.error('[PORT ERROR] Exhausted port retry attempts. Please free the port or set PORT env var.');
            process.exit(1);
          }
        } else {
          console.error('[SERVER ERROR]', err);
          process.exit(1);
        }
      });
    } catch (err) {
      if (attempt < maxRetries) {
        await startServer(Number(port) + 1, attempt + 1);
      } else {
        console.error('[STARTUP ERROR]', err);
        process.exit(1);
      }
    }
  }

  startServer(PORT);
}

// Export for Vercel Serverless Functions
export default app;
