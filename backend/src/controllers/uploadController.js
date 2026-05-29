import { IngestionService } from '../services/ingestionService.js';
import fs from 'fs/promises';

export async function handleUpload(req, res, next) {
  try {
    const files = req.files?.length ? req.files : (req.file ? [req.file] : []);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Please attach PDF, DOCX, or TXT legal documents.' });
    }

    if (files.length > 50) {
      return res.status(400).json({ error: 'You can upload up to 50 legal documents at once.' });
    }

    const results = [];

    for (const file of files) {
      const { originalname, mimetype } = file;

      let buffer;
      if (file.buffer) {
        buffer = file.buffer;
      } else if (file.path) {
        buffer = await fs.readFile(file.path);
        try {
          await fs.unlink(file.path);
        } catch (err) {
          console.warn('[UPLOAD CLEANUP WARN]', err.message || err);
        }
      } else {
        return res.status(400).json({ error: `Uploaded file "${originalname}" is missing buffer or path.` });
      }

      console.log(`[UPLOAD] Legal document received: ${originalname} (${mimetype}), size ${buffer.length} bytes`);

      const result = await IngestionService.ingestDocument({ buffer, originalname, mimetype });
      results.push(result);
    }

    const totals = results.reduce(
      (acc, item) => ({
        chunkCount: acc.chunkCount + item.chunkCount,
        charCount: acc.charCount + item.charCount,
      }),
      { chunkCount: 0, charCount: 0 }
    );

    return res.status(200).json({
      success: true,
      files: results,
      ...totals,
      message: `${results.length} legal document${results.length === 1 ? '' : 's'} parsed and indexed successfully.`,
    });
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    next(error);
  }
}
