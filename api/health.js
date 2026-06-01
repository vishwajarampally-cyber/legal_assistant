import { LangSmithService } from '../backend/src/services/langsmithService.js';

export default function handler(req, res) {
  return res.status(200).json({
    status: 'online',
    message: 'Legal Assistant backend is running.',
    timestamp: new Date().toISOString(),
    langsmith: LangSmithService.getStatus(),
  });
}
