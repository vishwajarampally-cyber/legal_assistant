import { RetrievalService } from '../services/retrievalService.js';

export async function handleQuery(req, res, next) {
  try {
    const { question, filename, filenames, conversationHistory } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    const scopedFilenames = Array.isArray(filenames)
      ? filenames.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : (filename && filename.trim() ? [filename.trim()] : []);

    if (scopedFilenames.length === 0) {
      return res.status(400).json({ error: 'At least one uploaded legal document filename is required for grounded search.' });
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
