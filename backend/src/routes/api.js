import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { handleUpload } from '../controllers/uploadController.js';
import { handleQuery } from '../controllers/queryController.js';
import { runEvaluation, getLatestEvaluation, getHistory, getAnalytics } from '../controllers/evaluationController.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { VectorService } from '../services/vectorService.js';
import { DocumentStoreService } from '../services/documentStoreService.js';

const router = express.Router();

router.use(requestLogger);

const uploadDir = process.env.UPLOAD_DIR || os.tmpdir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

function parseFileSize(val) {
  if (!val) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return undefined;
  const normalized = val.trim().toUpperCase();
  // If it's a plain number string, return as bytes
  if (/^[0-9]+$/.test(normalized)) return Number(normalized);
  const match = normalized.match(/^([0-9]+)(B|KB|MB|GB)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  switch (unit) {
    case 'B':
      return n;
    case 'KB':
      return n * 1024;
    case 'MB':
      return n * 1024 * 1024;
    case 'GB':
      return n * 1024 * 1024 * 1024;
    default:
      return n;
  }
}

const defaultMax = 50 * 1024 * 1024;
const envMax = parseFileSize(process.env.MAX_FILE_SIZE);
const uploadMax = typeof envMax === 'number' && !Number.isNaN(envMax) ? envMax : defaultMax;

const upload = multer({
  storage,
  limits: { fileSize: uploadMax },
});

router.post('/upload', upload.array('files', 50), handleUpload);
router.post('/query', handleQuery);

router.post('/evaluation/run', runEvaluation);
router.get('/evaluation/latest', getLatestEvaluation);
router.get('/evaluation/history', getHistory);
router.get('/evaluation/analytics', getAnalytics);

router.get('/documents', async (req, res, next) => {
  try {
    const documents = await DocumentStoreService.listDocuments();
    return res.status(200).json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error('[DOCUMENT LIST ERROR]', error);
    next(error);
  }
});

router.delete('/reset', async (req, res, next) => {
  try {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ error: 'Filename parameter is required to perform reset.' });
    }

    await VectorService.deleteVectorsByFilename(filename);
    await DocumentStoreService.deleteDocument(filename);
    return res.status(200).json({
      success: true,
      message: `Successfully cleared backend document and vector index context for: ${filename}`,
    });
  } catch (error) {
    console.error('[RESET ERROR]', error);
    next(error);
  }
});

export default router;
