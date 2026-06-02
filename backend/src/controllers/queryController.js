import { RetrievalService } from '../services/retrievalService.js';
import { DocumentStoreService } from '../services/documentStoreService.js';

export async function handleQuery(req, res, next) {
  try {
    const { question, filename, filenames, conversationHistory } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    let scopedFilenames = Array.isArray(filenames)
      ? filenames.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : (filename && filename.trim() ? [filename.trim()] : []);

    if (scopedFilenames.length === 0) {
      scopedFilenames = await DocumentStoreService.listFilenames();
    }

    if (scopedFilenames.length === 0) {
      return res.status(400).json({ error: 'No indexed legal documents are available. Upload documents before asking questions.' });
    }

    console.log(`[QUERY REQUEST] files=${scopedFilenames.join(', ')} question="${question}"`);

    const response = await RetrievalService.queryDocuments({
      question: question.trim(),
      filenames: scopedFilenames,
      conversationHistory,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('[QUERY ERROR]', error);
    next(error);
  }
}
